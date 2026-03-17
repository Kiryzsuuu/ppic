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
    include: {
      user: { include: { profile: { select: { fullName: true, licenseNo: true } } } },
      simulator: true,
      slot: true,
      certificate: { select: { id: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return jsonOk({ bookings });
}
