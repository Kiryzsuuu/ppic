import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId") || undefined;

  const slots = await prisma.scheduleSlot.findMany({
    where: simulatorId ? { simulatorId } : undefined,
    include: {
      simulator: true,
      booking: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              profile: { select: { fullName: true } },
            },
          },
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  return jsonOk({ slots });
}
