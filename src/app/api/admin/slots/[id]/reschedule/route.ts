import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";
import { getWetSessionKeyForRange } from "@/lib/schedule";

const BodySchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = BodySchema.parse(body);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!(startAt < endAt)) return jsonError("Waktu mulai harus lebih awal dari waktu selesai.", 400);

    if (!getWetSessionKeyForRange(startAt, endAt)) {
      return jsonError(
        "Slot harus sesuai sesi WET (07:30–11:30 atau 11:45–15:45 WIB).",
        400,
      );
    }

    const slot = await prisma.scheduleSlot.findUnique({
      where: { id },
      include: { booking: { select: { id: true, userId: true } }, simulator: true },
    });
    if (!slot) return jsonError("Slot tidak ditemukan", 404);

    const dryConflict = await prisma.booking.findFirst({
      where: {
        simulatorId: slot.simulatorId,
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
        id: { not: slot.id },
        simulatorId: slot.simulatorId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (conflict) return jsonError("Slot bentrok dengan slot lain", 409);

    const ip = getClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const s = await tx.scheduleSlot.update({
        where: { id: slot.id },
        data: { startAt, endAt },
        select: { id: true, startAt: true, endAt: true, status: true, bookingId: true },
      });
      return s;
    });

    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.slot.rescheduled",
        targetType: "ScheduleSlot",
        targetId: slot.id,
        ip,
        userAgent,
        metadata: {
          bookingId: slot.bookingId,
          simulatorId: slot.simulatorId,
          from: { startAt: slot.startAt, endAt: slot.endAt },
          to: { startAt, endAt },
        },
      });
    } catch {
      // ignore
    }

    if (slot.booking?.userId) {
      try {
        await createNotification({
          userId: slot.booking.userId,
          kind: "SCHEDULE",
          title: "Jadwal diubah oleh admin",
          body: `Jadwal simulator Anda telah dijadwalkan ulang. Silakan cek detail booking Anda.`,
          metadata: { bookingId: slot.booking.id, slotId: slot.id, startAt, endAt },
        });
      } catch {
        // ignore
      }
    }

    return jsonOk({ slot: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
