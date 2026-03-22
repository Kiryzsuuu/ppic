import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { sendPaymentValidatedEmail } from "@/lib/emails";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

const ValidateSchema = z.object({
  approve: z.boolean(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = ValidateSchema.parse(body);

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!payment) return jsonError("Payment tidak ditemukan", 404);
    if (payment.status !== "PAID") return jsonError("Payment tidak dalam status PAID", 400);

    if (input.approve && payment.booking.leaseType === "DRY") {
      const reqStart = payment.booking.requestedStartAt;
      const reqEnd = payment.booking.requestedEndAt;
      if (!reqStart || !reqEnd) return jsonError("Jadwal DRY belum diisi", 400);

      const wetBookedConflict = await prisma.scheduleSlot.findFirst({
        where: {
          simulatorId: payment.booking.simulatorId,
          bookingId: { not: null },
          startAt: { lt: reqEnd },
          endAt: { gt: reqStart },
        },
        select: { id: true },
      });

      if (wetBookedConflict) {
        return jsonError(
          "Jadwal DRY bentrok dengan sesi WET yang sudah terisi (BOOKED)",
          409,
        );
      }
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.payment.update({
        where: { id },
        data: {
          status: input.approve ? "VALIDATED" : "REJECTED",
          validatedById: session.userId,
          validatedAt: new Date(),
        },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: input.approve ? "CONFIRMED" : "WAIT_PAYMENT" },
      });

      return p;
    });

    const bookingFull = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: {
        user: { select: { id: true, email: true, profile: { select: { email: true, fullName: true } } } },
      },
    });
    const userId = bookingFull?.user.id;
    const email = (bookingFull?.user.email ?? bookingFull?.user.profile?.email)?.trim().toLowerCase();
    const fullName = bookingFull?.user.profile?.fullName ?? null;

    const ip = getClientIpFromHeaders(req.headers);
    const deviceId = getDeviceIdFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: input.approve ? "payment.validated" : "payment.rejected",
        targetType: "Payment",
        targetId: updated.id,
        ip,
        deviceId,
        userAgent,
        metadata: { bookingId: payment.bookingId },
      });
    } catch {
      // ignore
    }

    if (userId) {
      try {
        await createNotification({
          userId,
          kind: "PAYMENT",
          title: input.approve ? "Pembayaran tervalidasi" : "Pembayaran ditolak",
          body: input.approve
            ? "Pembayaran Anda telah tervalidasi. Booking akan diproses untuk penjadwalan."
            : "Pembayaran Anda ditolak. Silakan unggah ulang bukti pembayaran.",
          metadata: { bookingId: payment.bookingId, paymentId: updated.id, approved: input.approve },
        });
      } catch {
        // ignore
      }
    }

    if (email) {
      try {
        await sendPaymentValidatedEmail({
          to: email,
          name: fullName,
          bookingId: payment.bookingId,
          approved: input.approve,
        });
      } catch {
        // ignore
      }
    }

    return jsonOk({ payment: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
