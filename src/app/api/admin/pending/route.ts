import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const profiles = await prisma.profile.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { id: true, username: true } }, documents: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const documents = await prisma.document.findMany({
    where: { status: "PENDING", type: { not: "PHOTO" } },
    include: { profile: { include: { user: { select: { id: true, username: true } } } } },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  const bookings = await prisma.booking.findMany({
    where: { status: "WAIT_ADMIN_VERIFICATION" },
    include: { user: { select: { id: true, username: true } }, simulator: true },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });

  return jsonOk({ profiles, documents, bookings });
}
