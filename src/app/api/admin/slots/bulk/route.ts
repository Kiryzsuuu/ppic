import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { WET_SESSIONS_WIB, getWetSessionKeyForRange, isWetFullDayRange } from "@/lib/schedule";

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

function endOfMonthWib(d: Date) {
  // Treat WIB as UTC+7 and compute end-of-month at 23:59:59.999 WIB.
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  // 23:59:59.999 WIB = 16:59:59.999Z
  return new Date(Date.UTC(y, m + 1, 0, 16, 59, 59, 999));
}

function buildWibDateTime(dateKey: string, min: number) {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+07:00`);
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

    const isSession = Boolean(getWetSessionKeyForRange(startAt0, endAt0));
    const isFullDay = isWetFullDayRange(startAt0, endAt0);

    if (!isSession && !isFullDay) {
      return jsonError(
        "Slot harus sesuai sesi WET (07:30–11:30 atau 11:45–15:45 WIB) atau full-day WET (07:30–15:45 WIB).",
        400,
      );
    }

    // Until end-of-day (WIB)
    let untilExclusive = new Date(`${input.untilDate}T23:59:59.999+07:00`);
    if (!Number.isFinite(untilExclusive.getTime())) return jsonError("untilDate tidak valid", 400);

    // UX expectation: "Bulanan" is used to fill a month (daily within the month) rather than
    // repeating only once per month. Limit the range to the startAt month (WIB).
    if (input.repeatUnit === "MONTH") {
      const monthEnd = endOfMonthWib(startAt0);
      if (monthEnd.getTime() < untilExclusive.getTime()) untilExclusive = monthEnd;
    }

    const MAX_OCCURRENCES = 500;

    let startAt = startAt0;
    let endAt = endAt0;

    let created = 0;
    let skippedConflict = 0;
    let stoppedByLimit = false;

    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      if (startAt.getTime() > untilExclusive.getTime()) break;

      const occurrenceDateKey = startAt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      const sessionsToCreate = isFullDay
        ? [
            {
              startAt: buildWibDateTime(occurrenceDateKey, WET_SESSIONS_WIB.MORNING.startMin),
              endAt: buildWibDateTime(occurrenceDateKey, WET_SESSIONS_WIB.MORNING.endMin),
            },
            {
              startAt: buildWibDateTime(occurrenceDateKey, WET_SESSIONS_WIB.AFTERNOON.startMin),
              endAt: buildWibDateTime(occurrenceDateKey, WET_SESSIONS_WIB.AFTERNOON.endMin),
            },
          ]
        : [{ startAt, endAt }];

      for (const ses of sessionsToCreate) {
        const dryConflict = await prisma.booking.findFirst({
          where: {
            simulatorId: input.simulatorId,
            leaseType: "DRY",
            status: { in: ["CONFIRMED", "COMPLETED"] },
            requestedStartAt: { not: null, lt: ses.endAt },
            requestedEndAt: { not: null, gt: ses.startAt },
          },
          select: { id: true },
        });

        if (dryConflict) {
          skippedConflict++;
          continue;
        }

        const conflict = await prisma.scheduleSlot.findFirst({
          where: {
            simulatorId: input.simulatorId,
            startAt: { lt: ses.endAt },
            endAt: { gt: ses.startAt },
          },
          select: { id: true },
        });

        if (conflict) {
          skippedConflict++;
          continue;
        }

        await prisma.scheduleSlot.create({
          data: {
            simulatorId: input.simulatorId,
            startAt: ses.startAt,
            endAt: ses.endAt,
            status: "AVAILABLE",
            createdByAdminId: session.userId,
          },
        });
        created++;
      }

      const stepUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" = input.repeatUnit === "MONTH" ? "DAY" : input.repeatUnit;
      startAt = addInterval(startAt, stepUnit, input.repeatEvery);
      endAt = addInterval(endAt, stepUnit, input.repeatEvery);
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
