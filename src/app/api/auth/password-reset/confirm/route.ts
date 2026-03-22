import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { consumePasswordResetToken } from "@/lib/passwordReset";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

const PASSWORD_RESET_COOKIE_NAME = "ppic_pwreset";

const ConfirmSchema = z.object({
  token: z.string().min(10).optional(),
  newPassword: z.string().min(6).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ConfirmSchema.parse(body);

    const jar = await cookies();
    const token = (input.token || jar.get(PASSWORD_RESET_COOKIE_NAME)?.value || "").trim();
    if (!token) return jsonError("Token reset tidak ditemukan. Silakan verifikasi OTP terlebih dahulu.", 400);

    const consumed = await consumePasswordResetToken({ token });
    if (!consumed.ok) return jsonError(consumed.error, 400);

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash },
    });

    const ip = getClientIpFromHeaders(req.headers);
    const deviceId = getDeviceIdFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    try {
      const u = await prisma.user.findUnique({ where: { id: consumed.userId }, select: { role: true } });
      await writeAuditLog({
        actorId: consumed.userId,
        actorRole: u?.role ?? "USER",
        action: "auth.password_reset",
        targetType: "User",
        targetId: consumed.userId,
        ip,
        deviceId,
        userAgent,
      });
    } catch {
      // ignore
    }

    // Clear reset cookie after successful password change
    jar.set(PASSWORD_RESET_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return jsonOk({ reset: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
