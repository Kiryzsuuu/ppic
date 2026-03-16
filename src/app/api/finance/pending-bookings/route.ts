import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const bookings = await prisma.booking.findMany({
    where: { status: "WAIT_FINANCE_DOCS" },
    include: { user: { select: { username: true } }, simulator: true },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return jsonOk({ bookings });
}
