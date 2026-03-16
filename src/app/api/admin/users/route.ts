import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { searchParams } = new URL(req.url);
  const takeRaw = Number(searchParams.get("take") ?? "200");
  if (!Number.isFinite(takeRaw)) return jsonError("Query tidak valid", 400);
  const take = Math.max(1, Math.min(500, Math.trunc(takeRaw)));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      profile: { select: { fullName: true, email: true, status: true } },
    },
  });

  return jsonOk({ users });
}
