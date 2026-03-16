import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { issuePasswordResetOtp } from "@/lib/passwordResetOtp";
import { sendPasswordResetOtpEmail } from "@/lib/emails";

const RequestSchema = z.object({
  email: z.string().email().max(160),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = RequestSchema.parse(body);

    const email = input.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { profile: { is: { email } } }],
      },
      select: {
        id: true,
        email: true,
        profile: { select: { email: true, fullName: true } },
      },
    });

    // Always return ok to avoid email enumeration.
    if (!user) return jsonOk({ sent: true });

    const to = (user.email ?? user.profile?.email)?.trim().toLowerCase();
    if (!to) return jsonOk({ sent: true });

    const { code, ttlMinutes } = await issuePasswordResetOtp({ userId: user.id, email: to });

    try {
      await sendPasswordResetOtpEmail({
        to,
        name: user.profile?.fullName,
        code,
        expiresMinutes: ttlMinutes,
      });
    } catch {
      // Best-effort in dev-safe mail mode
    }

    return jsonOk({ sent: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
