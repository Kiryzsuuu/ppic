import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const { id } = await ctx.params;

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) return jsonError("Notifikasi tidak ditemukan", 404);
  if (notif.userId !== session.userId) return jsonError("Forbidden", 403);

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: notif.readAt ?? new Date() },
    select: { id: true, readAt: true },
  });

  return jsonOk({ notification: updated });
}
