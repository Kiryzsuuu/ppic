import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId");
  if (!simulatorId) return jsonError("simulatorId wajib", 400);

  const now = new Date();

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      simulatorId,
      startAt: { gt: now },
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  return jsonOk({ slots });
}
