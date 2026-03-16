import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const BulkCreateSchema = z.object({
  simulatorId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // WIB date key
  repeatUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).default("DAY"),
  repeatEvery: z.number().int().min(1).max(366).default(1),
});

function addInterval(d: Date, unit: "DAY" | "WEEK" | "MONTH" | "YEAR", every: number) {
  const next = new Date(d);
  if (unit === "DAY") next.setDate(next.getDate() + every);
  else if (unit === "WEEK") next.setDate(next.getDate() + every * 7);
  else if (unit === "MONTH") next.setMonth(next.getMonth() + every);
  else next.setFullYear(next.getFullYear() + every);
  return next;
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = BulkCreateSchema.parse(body);

    const startAt0 = new Date(input.startAt);
    const endAt0 = new Date(input.endAt);
    if (!(startAt0 < endAt0)) return jsonError("Waktu mulai harus lebih awal dari waktu selesai.", 400);

    // Until end-of-day (WIB)
    const untilExclusive = new Date(`${input.untilDate}T23:59:59+07:00`);
    if (!Number.isFinite(untilExclusive.getTime())) return jsonError("untilDate tidak valid", 400);

    const MAX_OCCURRENCES = 500;

    let startAt = startAt0;
    let endAt = endAt0;

    let created = 0;
    let skippedConflict = 0;
    let stoppedByLimit = false;

    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      if (startAt.getTime() > untilExclusive.getTime()) break;

      const conflict = await prisma.scheduleSlot.findFirst({
        where: {
          simulatorId: input.simulatorId,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      });

      if (conflict) {
        skippedConflict++;
      } else {
        await prisma.scheduleSlot.create({
          data: {
            simulatorId: input.simulatorId,
            startAt,
            endAt,
            status: "AVAILABLE",
            createdByAdminId: session.userId,
          },
        });
        created++;
      }

      startAt = addInterval(startAt, input.repeatUnit, input.repeatEvery);
      endAt = addInterval(endAt, input.repeatUnit, input.repeatEvery);
    }

    // If we hit the guard but still not beyond until, mark stopped.
    if (startAt.getTime() <= untilExclusive.getTime()) stoppedByLimit = true;

    return jsonOk({
      created,
      skippedConflict,
      stoppedByLimit,
      maxOccurrences: MAX_OCCURRENCES,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
