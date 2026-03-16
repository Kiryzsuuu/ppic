import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getWetSessionKeyForRange } from "@/lib/schedule";

const SelectSchema = z.object({
  slotId: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["USER"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = SelectSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!booking) return jsonError("Booking tidak ditemukan", 404);
    if (booking.userId !== session.userId) return jsonError("Forbidden", 403);

    if (booking.payment?.status !== "VALIDATED") {
      return jsonError("Pembayaran harus tervalidasi sebelum memilih jadwal", 400);
    }

    const slot = await prisma.scheduleSlot.findUnique({ where: { id: input.slotId } });
    if (!slot) return jsonError("Slot tidak ditemukan", 404);
    if (slot.simulatorId !== booking.simulatorId) return jsonError("Slot tidak sesuai simulator booking", 400);
    if (slot.status !== "AVAILABLE") return jsonError("Slot tidak tersedia", 409);

    // WET lease must use fixed sessions.
    if (booking.leaseType === "WET") {
      const sessionKey = getWetSessionKeyForRange(slot.startAt, slot.endAt);
      if (!sessionKey) {
        return jsonError(
          "Untuk Wet Leased, jadwal hanya tersedia per sesi: 07:30-11:30 (Sesi Pagi) atau 11:45-15:45 (Sesi Siang).",
          400
        );
      }

      // Block WET session selection if there is an overlapping CONFIRMED/COMPLETED DRY booking.
      const dryConflict = await prisma.booking.findFirst({
        where: {
          simulatorId: booking.simulatorId,
          leaseType: "DRY",
          status: { in: ["CONFIRMED", "COMPLETED"] },
          requestedStartAt: { not: null, lt: slot.endAt },
          requestedEndAt: { not: null, gt: slot.startAt },
        },
        select: { id: true },
      });

      if (dryConflict) {
        return jsonError("Slot sesi bentrok dengan booking Dry Leased yang sudah terkonfirmasi.", 409);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.scheduleSlot.update({
        where: { id: slot.id },
        data: { status: "BOOKED", bookingId: booking.id },
      });

      const b = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      return { slot: s, booking: b };
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
