import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id },
    include: { booking: { select: { id: true, userId: true, status: true } }, simulator: true },
  });

  if (!slot) return jsonError("Slot tidak ditemukan", 404);
  if (!slot.bookingId || !slot.booking) return jsonError("Slot belum dibooking", 400);
  if (slot.status !== "BOOKED") return jsonError("Hanya slot BOOKED yang bisa dicancel", 400);

  const ip = getClientIpFromHeaders(req.headers);
  const userAgent = req.headers.get("user-agent");

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.update({
      where: { id: slot.bookingId! },
      data: { status: "CANCELLED", preferredSlotId: null },
      select: { id: true, userId: true },
    });

    const freed = await tx.scheduleSlot.update({
      where: { id: slot.id },
      data: { status: "AVAILABLE", bookingId: null },
      select: { id: true, status: true },
    });

    return { booking, slot: freed };
  });

  try {
    await writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "admin.slot.cancelled",
      targetType: "ScheduleSlot",
      targetId: slot.id,
      ip,
      userAgent,
      metadata: { bookingId: slot.bookingId, simulatorId: slot.simulatorId, startAt: slot.startAt, endAt: slot.endAt },
    });
  } catch {
    // ignore
  }

  try {
    await createNotification({
      userId: updated.booking.userId,
      kind: "SCHEDULE",
      title: "Jadwal dibatalkan oleh admin",
      body: `Jadwal simulator Anda dibatalkan oleh admin. Silakan hubungi admin untuk penjadwalan ulang.`,
      metadata: { bookingId: updated.booking.id, slotId: slot.id },
    });
  } catch {
    // ignore
  }

  return jsonOk(updated);
}
