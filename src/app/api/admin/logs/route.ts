import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { searchParams } = new URL(req.url);
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const skipRaw = Number(searchParams.get("skip") ?? "0");

  if (!Number.isFinite(takeRaw) || !Number.isFinite(skipRaw)) return jsonError("Query tidak valid", 400);
  const take = Math.max(1, Math.min(200, Math.trunc(takeRaw)));
  const skip = Math.max(0, Math.trunc(skipRaw));

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { actor: { select: { username: true } } },
    }),
  ]);

  return jsonOk({ total, skip, take, logs });
}
