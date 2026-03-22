import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { signSession, setSessionCookie } from "@/lib/session";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = LoginSchema.parse(body);

    const identifier = input.identifier.trim();
    const identifierEmail = identifier.includes("@") ? identifier.toLowerCase() : identifier;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
          { email: identifierEmail },
          { profile: { is: { email: identifier } } },
          { profile: { is: { email: identifierEmail } } },
        ],
      },
    });

    if (!user) return jsonError("Username/Email atau password salah", 401);

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) return jsonError("Username/Email atau password salah", 401);

    const ip = getClientIpFromHeaders(req.headers);
    const deviceId = getDeviceIdFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");

    // Best-effort login tracking (do not block login if it fails)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ip, lastLoginUserAgent: userAgent },
      });
    } catch {
      // ignore
    }

    try {
      await writeAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "auth.login",
        targetType: "User",
        targetId: user.id,
        ip,
        deviceId,
        userAgent,
      });
    } catch {
      // ignore
    }

    const emailVerifiedAt = (user as unknown as { emailVerifiedAt?: Date | string | null }).emailVerifiedAt;
    const emailVerified = Boolean(emailVerifiedAt);

    const token = await signSession({ userId: user.id, username: user.username, role: user.role, emailVerified });
    await setSessionCookie(token);

    return jsonOk({
      user: { id: user.id, username: user.username, role: user.role, emailVerified },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth.login] error", e);
    }
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
