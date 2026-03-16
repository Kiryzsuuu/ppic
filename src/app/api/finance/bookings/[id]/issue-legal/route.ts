import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const IssueSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000),
});

function generateVaNumber() {
  return "VA" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = IssueSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!booking) return jsonError("Booking tidak ditemukan", 404);
    if (booking.status !== "WAIT_FINANCE_DOCS") return jsonError("Status booking tidak sesuai", 400);

    const profile = await prisma.profile.findUnique({ where: { userId: booking.userId } });
    if (!profile) return jsonError("Profil tidak ditemukan", 404);

    const legalType = profile.registrationType === "COMPANY" ? "PKS" : "BERITA_ACARA";

    const vaNumber = generateVaNumber();

    const result = await prisma.$transaction(async (tx) => {
      const legalDoc = await tx.legalDocument.create({
        data: {
          bookingId: booking.id,
          type: legalType,
          status: "ISSUED",
          issuedById: session.userId,
        },
      });

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: input.amount,
          vaNumber,
          status: "UNPAID",
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "WAIT_PAYMENT" },
      });

      return { legalDoc, payment, updatedBooking };
    });

    return jsonOk(result);
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
