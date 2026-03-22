import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

const BodySchema = z.object({
  role: z.enum(["USER", "ADMIN", "FINANCE", "INSTRUCTOR"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = BodySchema.parse(body);

    if (id === session.userId && input.role !== "ADMIN") {
      return jsonError("Tidak bisa menurunkan role akun sendiri", 400);
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!user) return jsonError("User tidak ditemukan", 404);

    const updated = await prisma.user.update({ where: { id }, data: { role: input.role } });

    const ip = getClientIpFromHeaders(req.headers);
    const deviceId = getDeviceIdFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.user.role_update",
        targetType: "User",
        targetId: id,
        ip,
        deviceId,
        userAgent,
        metadata: { from: user.role, to: input.role },
      });
    } catch {
      // ignore
    }

    return jsonOk({ user: { id: updated.id, role: updated.role } });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
