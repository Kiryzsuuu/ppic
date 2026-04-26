import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const BulkCreateSchema = z.object({
  simulatorId: z.string().min(1),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // WIB date key
  repeatUnit: z.enum(["WEEK", "MONTH"]).optional(),
  repeatEvery: z.number().int().min(1).max(366).optional().default(1),
  workdaysOnly: z.boolean().optional().default(false),
  autoGenerateHourly: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = BulkCreateSchema.parse(body);

    // Until end-of-day (WIB)
    let untilExclusive = new Date(`${input.untilDate}T23:59:59.999+07:00`);
    if (!Number.isFinite(untilExclusive.getTime())) return jsonError("untilDate tidak valid", 400);

    const MAX_OCCURRENCES = 500;
    let created = 0;
    let skippedConflict = 0;
    let stoppedByLimit = false;

    // Operating hours (per jam): 07:30-08:30, 08:30-09:30, ..., 14:45-15:45
    const operatingHours = [
      { startMin: 7 * 60 + 30, endMin: 8 * 60 + 30 },
      { startMin: 8 * 60 + 30, endMin: 9 * 60 + 30 },
      { startMin: 9 * 60 + 30, endMin: 10 * 60 + 30 },
      { startMin: 10 * 60 + 30, endMin: 11 * 60 + 30 },
      { startMin: 11 * 60 + 45, endMin: 12 * 60 + 45 },
      { startMin: 12 * 60 + 45, endMin: 13 * 60 + 45 },
      { startMin: 13 * 60 + 45, endMin: 14 * 60 + 45 },
      { startMin: 14 * 60 + 45, endMin: 15 * 60 + 45 },
    ];

    // Calculate start date for iteration
    const today = new Date();
    let currentDate = new Date(today.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) + "T00:00:00+07:00");

    let occurrenceCount = 0;
    while (currentDate.getTime() <= untilExclusive.getTime() && occurrenceCount < MAX_OCCURRENCES) {
      // Skip weekends if workdaysOnly is enabled
      if (input.workdaysOnly) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      }

      const dateKey = currentDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

      // Create hourly slots
      for (const hour of operatingHours) {
        const hh = String(Math.floor(hour.startMin / 60)).padStart(2, "0");
        const mm = String(hour.startMin % 60).padStart(2, "0");
        const hh_end = String(Math.floor(hour.endMin / 60)).padStart(2, "0");
        const mm_end = String(hour.endMin % 60).padStart(2, "0");

        const startAt = new Date(`${dateKey}T${hh}:${mm}:00+07:00`);
        const endAt = new Date(`${dateKey}T${hh_end}:${mm_end}:00+07:00`);

        // Check DRY conflict
        const dryConflict = await prisma.booking.findFirst({
          where: {
            simulatorId: input.simulatorId,
            leaseType: "DRY",
            status: { in: ["CONFIRMED", "COMPLETED"] },
            requestedStartAt: { not: null, lt: endAt },
            requestedEndAt: { not: null, gt: startAt },
          },
          select: { id: true },
        });
        if (dryConflict) {
          skippedConflict++;
          continue;
        }

        // Check slot conflict
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
          continue;
        }

        // Create slot
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

      currentDate.setDate(currentDate.getDate() + 1);
      occurrenceCount++;
    }

    if (occurrenceCount >= MAX_OCCURRENCES) stoppedByLimit = true;

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
