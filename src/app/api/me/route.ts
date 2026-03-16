import { jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerifiedAt: true, username: true, role: true },
  });

  const photo = await prisma.document.findFirst({
    where: { type: "PHOTO", profile: { is: { userId: session.userId } } },
    select: { id: true },
  });

  const avatarUrl = photo ? `/api/documents/${photo.id}/download` : null;

  return jsonOk(
    { session, user, avatarUrl },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
