import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";

  if (mine) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    if (!profile) return jsonOk({ documents: [] });

    const documents = await prisma.document.findMany({
      where: { profileId: profile.id },
      orderBy: { uploadedAt: "desc" },
    });

    return jsonOk({ documents });
  }

  if (session.role === "USER") {
    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    if (!profile) return jsonOk({ documents: [] });

    const documents = await prisma.document.findMany({
      where: { profileId: profile.id },
      orderBy: { uploadedAt: "desc" },
    });

    return jsonOk({ documents });
  }

  // For staff roles, return latest documents to support verification UI
  const documents = await prisma.document.findMany({
    include: { profile: { include: { user: { select: { username: true } } } } },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  return jsonOk({ documents });
}
