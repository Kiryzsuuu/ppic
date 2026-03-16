import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

function generateQrValue(bookingId: string) {
  return `PPI-CRT-${bookingId}-${crypto.randomBytes(6).toString("hex")}`;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { logbookEntries: true, certificate: true },
  });

  if (!booking) return jsonError("Booking tidak ditemukan", 404);
  if (booking.certificate) return jsonError("Sertifikat sudah ada", 400);
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    return jsonError("Booking belum dapat diterbitkan sertifikat", 400);
  }

  if (booking.leaseType === "WET" && booking.logbookEntries.length === 0) {
    return jsonError("Logbook wajib diisi Instructor sebelum sertifikat diterbitkan (Wet Leased)", 400);
  }

  const cert = await prisma.certificate.create({
    data: {
      bookingId: booking.id,
      qrValue: generateQrValue(booking.id),
      issuedById: session.userId,
    },
  });

  return jsonOk({ certificate: cert });
}
