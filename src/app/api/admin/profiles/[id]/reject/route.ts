import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return jsonError("Profil tidak ditemukan", 404);

  const updated = await prisma.profile.update({
    where: { id },
    data: { status: "REJECTED", verifiedById: session.userId, verifiedAt: new Date() },
  });

  return jsonOk({ profile: updated });
}
