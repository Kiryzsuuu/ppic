import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { WET_SESSIONS_WIB, getWetSessionKeyForRange, isWetFullDayRange } from "@/lib/schedule";

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CreateSlotSchema = z.object({
  simulatorId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId") || undefined;
  const from = parseDateOrNull(url.searchParams.get("from"));
  const to = parseDateOrNull(url.searchParams.get("to"));

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      ...(simulatorId ? { simulatorId } : null),
      ...(from && to ? { startAt: { lt: to }, endAt: { gt: from } } : null),
    },
    include: { simulator: true, booking: { include: { user: { select: { username: true } } } } },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  return jsonOk({ slots });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = CreateSlotSchema.parse(body);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!(startAt < endAt)) return jsonError("Waktu mulai harus lebih awal dari waktu selesai.", 400);

    const isSession = Boolean(getWetSessionKeyForRange(startAt, endAt));
    const isFullDay = isWetFullDayRange(startAt, endAt);

    if (!isSession && !isFullDay) {
      return jsonError(
        "Slot harus sesuai sesi WET (07:30–11:30 atau 11:45–15:45 WIB) atau full-day WET (07:30–15:45 WIB).",
        400,
      );
    }

    if (isFullDay) {
      const dayKey = startAt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

      const morningStartAt = new Date(
        `${dayKey}T${String(Math.floor(WET_SESSIONS_WIB.MORNING.startMin / 60)).padStart(2, "0")}:${String(
          WET_SESSIONS_WIB.MORNING.startMin % 60,
        ).padStart(2, "0")}:00+07:00`,
      );
      const morningEndAt = new Date(
        `${dayKey}T${String(Math.floor(WET_SESSIONS_WIB.MORNING.endMin / 60)).padStart(2, "0")}:${String(
          WET_SESSIONS_WIB.MORNING.endMin % 60,
        ).padStart(2, "0")}:00+07:00`,
      );
      const afternoonStartAt = new Date(
        `${dayKey}T${String(Math.floor(WET_SESSIONS_WIB.AFTERNOON.startMin / 60)).padStart(2, "0")}:${String(
          WET_SESSIONS_WIB.AFTERNOON.startMin % 60,
        ).padStart(2, "0")}:00+07:00`,
      );
      const afternoonEndAt = new Date(
        `${dayKey}T${String(Math.floor(WET_SESSIONS_WIB.AFTERNOON.endMin / 60)).padStart(2, "0")}:${String(
          WET_SESSIONS_WIB.AFTERNOON.endMin % 60,
        ).padStart(2, "0")}:00+07:00`,
      );

      const sessions = [
        { startAt: morningStartAt, endAt: morningEndAt },
        { startAt: afternoonStartAt, endAt: afternoonEndAt },
      ];

      const createdSlots: Array<{
        id: string;
        simulatorId: string;
        startAt: Date;
        endAt: Date;
        status: string;
        createdByAdminId: string;
        createdAt: Date;
        bookingId: string | null;
        simulator: any;
      }> = [];
      for (const ses of sessions) {
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
        if (dryConflict) continue;

        const conflict = await prisma.scheduleSlot.findFirst({
          where: {
            simulatorId: input.simulatorId,
            startAt: { lt: ses.endAt },
            endAt: { gt: ses.startAt },
          },
          select: { id: true },
        });
        if (conflict) continue;

        const slot = await prisma.scheduleSlot.create({
          data: {
            simulatorId: input.simulatorId,
            startAt: ses.startAt,
            endAt: ses.endAt,
            status: "AVAILABLE",
            createdByAdminId: session.userId,
          },
          include: { simulator: true },
        });
        createdSlots.push(slot);
      }

      if (createdSlots.length === 0) {
        return jsonError("Tidak ada slot yang bisa dibuat (bentrok dengan slot lain atau booking DRY terkonfirmasi).", 409);
      }

      return jsonOk({ slots: createdSlots });
    }

    // Single session
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
    if (dryConflict) return jsonError("Slot bentrok dengan booking Dry Leased yang sudah terkonfirmasi", 409);

    const conflict = await prisma.scheduleSlot.findFirst({
      where: {
        simulatorId: input.simulatorId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) return jsonError("Slot bentrok dengan slot lain", 409);

    const slot = await prisma.scheduleSlot.create({
      data: {
        simulatorId: input.simulatorId,
        startAt,
        endAt,
        status: "AVAILABLE",
        createdByAdminId: session.userId,
      },
      include: { simulator: true },
    });

    return jsonOk({ slot });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
