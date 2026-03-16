import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { verifyPasswordResetOtp } from "@/lib/passwordResetOtp";
import { issuePasswordResetToken } from "@/lib/passwordReset";

const PASSWORD_RESET_COOKIE_NAME = "ppic_pwreset";

const VerifySchema = z.object({
  email: z.string().email().max(160),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = VerifySchema.parse(body);

    const email = input.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { profile: { is: { email } } }],
      },
      select: { id: true },
    });
    if (!user) return jsonError("OTP salah atau email tidak ditemukan", 400);

    await verifyPasswordResetOtp({ userId: user.id, code: input.code });

    // After OTP verified, issue a short-lived reset token and store in httpOnly cookie.
    const { token } = await issuePasswordResetToken({ userId: user.id });
    const jar = await cookies();
    jar.set(PASSWORD_RESET_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return jsonOk({ verified: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError(e instanceof Error ? e.message : "Server error", 400);
  }
}
