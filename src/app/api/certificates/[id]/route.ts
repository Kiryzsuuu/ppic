import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const { id } = await ctx.params;

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          user: { include: { profile: true } },
          simulator: true,
          slot: true,
        },
      },
      issuedBy: { select: { id: true, username: true, role: true } },
    },
  });

  if (!cert) return jsonError("Sertifikat tidak ditemukan", 404);

  const isOwner = session.role === "USER" && cert.booking.userId === session.userId;
  const isStaff = session.role !== "USER";
  if (!isOwner && !isStaff) return jsonError("Forbidden", 403);

  return jsonOk({ certificate: cert });
}
