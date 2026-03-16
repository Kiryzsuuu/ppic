import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id },
    select: { id: true, status: true, bookingId: true },
  });
  if (!slot) return jsonError("Slot tidak ditemukan", 404);

  if (slot.status === "BOOKED" || slot.bookingId) {
    return jsonError("Slot sudah dibooking. Cancel booking terlebih dahulu sebelum delete.", 409);
  }

  await prisma.scheduleSlot.delete({ where: { id } });

  const ip = getClientIpFromHeaders(req.headers);
  const userAgent = req.headers.get("user-agent");
  try {
    await writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "admin.slot.deleted",
      targetType: "ScheduleSlot",
      targetId: id,
      ip,
      userAgent,
    });
  } catch {
    // ignore
  }

  return jsonOk({ deleted: true });
}
