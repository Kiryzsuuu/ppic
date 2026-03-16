import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return jsonError("Booking tidak ditemukan", 404);
  if (booking.status !== "WAIT_ADMIN_VERIFICATION") return jsonError("Status booking tidak sesuai", 400);

  const profile = await prisma.profile.findUnique({ where: { userId: booking.userId } });
  if (!profile || profile.status !== "APPROVED") {
    return jsonError("Profil user belum disetujui", 400);
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "WAIT_FINANCE_DOCS" },
  });

  return jsonOk({ booking: updated });
}
