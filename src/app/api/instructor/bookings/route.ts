import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const bookings = await prisma.booking.findMany({
    where: {
      leaseType: "WET",
      status: "CONFIRMED",
      slot: { isNot: null },
    },
    include: { user: { select: { username: true } }, simulator: true, slot: true },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return jsonOk({ bookings });
}
