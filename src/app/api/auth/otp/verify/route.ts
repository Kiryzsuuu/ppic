import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import { verifyEmailOtp } from "@/lib/emailVerification";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/session";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/emails";

const VerifySchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  try {
    const body = await req.json();
    const input = VerifySchema.parse(body);

    await verifyEmailOtp(session.userId, input.code);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, role: true, email: true, profile: { select: { email: true, fullName: true } } },
    });

    const email = (user?.email ?? user?.profile?.email)?.trim().toLowerCase();
    const fullName = user?.profile?.fullName ?? null;

    // Refresh session token with emailVerified=true
    if (user) {
      const token = await signSession({
        userId: user.id,
        username: user.username,
        role: user.role,
        emailVerified: true,
      });
      await setSessionCookie(token);
    }

    const ip = getClientIpFromHeaders(req.headers);
    const deviceId = getDeviceIdFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "auth.email_verified",
        targetType: "User",
        targetId: session.userId,
        ip,
        deviceId,
        userAgent,
      });
    } catch {
      // ignore
    }

    // Best-effort welcome email
    if (email) {
      try {
        await sendWelcomeEmail({ to: email, name: fullName });
      } catch {
        // ignore
      }
    }
    return jsonOk({ verified: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError(e instanceof Error ? e.message : "Gagal verifikasi OTP", 400);
  }
}
