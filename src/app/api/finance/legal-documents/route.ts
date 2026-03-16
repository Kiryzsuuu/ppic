import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const legalDocs = await prisma.legalDocument.findMany({
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: {
      booking: {
        include: {
          user: { select: { username: true } },
          simulator: true,
        },
      },
    },
  });

  return jsonOk({ legalDocs });
}
