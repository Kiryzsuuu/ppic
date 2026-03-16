import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;

  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, kind: true, readAt: true, createdAt: true },
    }),
  ]);

  return jsonOk({ unreadCount, notifications });
}
