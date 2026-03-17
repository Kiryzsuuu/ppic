import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getWetSessionKeyForRange } from "@/lib/schedule";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

const BookSchema = z.object({
  userId: z.string().min(1),
  trainingCode: z.enum(["PPC", "TYPE_RATING", "OTHER"]),
  trainingName: z.string().min(2).max(120),
  personCount: z.number().int().min(1).max(2).default(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const input = BookSchema.parse(body);

    const slot = await prisma.scheduleSlot.findUnique({
      where: { id },
      include: { simulator: true, booking: { select: { id: true } } },
    });

    if (!slot) return jsonError("Slot tidak ditemukan", 404);
    if (slot.status !== "AVAILABLE" || slot.bookingId) return jsonError("Slot tidak tersedia", 409);

    // Only allow booking session slots for WET.
    const sessionKey = getWetSessionKeyForRange(slot.startAt, slot.endAt);
    if (!sessionKey) {
      return jsonError(
        "Slot tidak valid untuk booking WET (harus sesi 07:30–11:30 atau 11:45–15:45 WIB).",
        400,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, username: true },
    });
    if (!user) return jsonError("User tidak ditemukan", 404);

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) return jsonError("Profil user belum ada", 409);

    // Block if there is an overlapping CONFIRMED/COMPLETED DRY booking.
    const dryConflict = await prisma.booking.findFirst({
      where: {
        simulatorId: slot.simulatorId,
        leaseType: "DRY",
        status: { in: ["CONFIRMED", "COMPLETED"] },
        requestedStartAt: { not: null, lt: slot.endAt },
        requestedEndAt: { not: null, gt: slot.startAt },
      },
      select: { id: true },
    });
    if (dryConflict) return jsonError("Slot sesi bentrok dengan booking Dry Leased yang sudah terkonfirmasi", 409);

    const ip = getClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          simulatorId: slot.simulatorId,
          leaseType: "WET",
          trainingCode: input.trainingCode,
          trainingName: input.trainingName,
          personCount: input.personCount,
          paymentMethod: "QRIS",
          preferredSlotId: slot.id,
          requestedStartAt: slot.startAt,
          requestedEndAt: slot.endAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
        select: { id: true, userId: true },
      });

      const updatedSlot = await tx.scheduleSlot.update({
        where: { id: slot.id },
        data: { status: "BOOKED", bookingId: booking.id },
        select: { id: true, status: true, bookingId: true },
      });

      return { booking, slot: updatedSlot };
    });

    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.slot.booked",
        targetType: "ScheduleSlot",
        targetId: slot.id,
        ip,
        userAgent,
        metadata: {
          bookingId: created.booking.id,
          bookedForUserId: user.id,
          simulatorId: slot.simulatorId,
          startAt: slot.startAt,
          endAt: slot.endAt,
        },
      });
    } catch {
      // ignore
    }

    try {
      await createNotification({
        userId: created.booking.userId,
        kind: "SCHEDULE",
        title: "Jadwal ditetapkan oleh admin",
        body: "Admin telah menetapkan jadwal simulator untuk Anda.",
        metadata: { bookingId: created.booking.id, slotId: slot.id },
      });
    } catch {
      // ignore
    }

    return jsonOk(created);
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
