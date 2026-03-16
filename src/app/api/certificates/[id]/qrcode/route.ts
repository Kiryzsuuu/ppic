import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const { id } = await ctx.params;

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: { booking: true },
  });

  if (!cert) return jsonError("Sertifikat tidak ditemukan", 404);

  const isOwner = session.role === "USER" && cert.booking.userId === session.userId;
  const isStaff = session.role !== "USER";
  if (!isOwner && !isStaff) return jsonError("Forbidden", 403);

  const png = await QRCode.toBuffer(cert.qrValue, {
    type: "png",
    width: 360,
    margin: 2,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
