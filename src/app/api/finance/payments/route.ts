import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const payments = await prisma.payment.findMany({
    where: { status: "PAID" },
    include: { booking: { include: { user: { select: { username: true } }, simulator: true } } },
    orderBy: { paidAt: "desc" },
    take: 100,
  });

  return jsonOk({ payments });
}
