import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "ppic_session";

export type SessionPayload = {
  userId: string;
  username: string;
  role: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR";
  emailVerified: boolean;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET env var");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  const secret = getJwtSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    const username = payload.username;
    const role = payload.role;

    const emailVerified = (payload as Record<string, unknown>).emailVerified;

    if (typeof userId !== "string" || typeof username !== "string" || typeof role !== "string") {
      return null;
    }

    if (!["USER", "ADMIN", "FINANCE", "INSTRUCTOR"].includes(role)) return null;

    // Backward compatible: tokens issued before this field existed are treated as verified.
    const emailVerifiedBool = typeof emailVerified === "boolean" ? emailVerified : true;

    return { userId, username, role: role as SessionPayload["role"], emailVerified: emailVerifiedBool };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
