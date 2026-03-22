import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";
import { issuePasswordResetOtp } from "@/lib/passwordResetOtp";
import { sendPasswordResetOtpEmail } from "@/lib/emails";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      email: true,
      profile: { select: { email: true, fullName: true } },
    },
  });
  if (!user) return jsonError("User tidak ditemukan", 404);


  const to = (user.email ?? user.profile?.email)?.trim().toLowerCase();
  if (!to) return jsonError("Email user belum diisi, tidak bisa kirim link reset", 400);

  const { code, ttlMinutes } = await issuePasswordResetOtp({ userId: user.id, email: to });

  try {
    await sendPasswordResetOtpEmail({
      to,
      name: user.profile?.fullName ?? null,
      code,
      expiresMinutes: ttlMinutes,
    });
  } catch {
    // Best-effort (dev-safe mailer may skip)
  }

  const ip = getClientIpFromHeaders(req.headers);
  const deviceId = getDeviceIdFromHeaders(req.headers);
  const userAgent = req.headers.get("user-agent");
  try {
    await writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "admin.user.reset_password",
      targetType: "User",
      targetId: id,
      ip,
      deviceId,
      userAgent,
    });
  } catch {
    // ignore
  }

  try {
    await createNotification({
      userId: id,
      kind: "ACCOUNT",
      title: "Password direset oleh admin",
      body: "Admin meminta reset password akun Anda. Silakan cek email untuk OTP reset password.",
      metadata: { by: session.userId },
    });
  } catch {
    // ignore
  }

  return jsonOk({ sent: true });
}
