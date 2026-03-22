import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "ppic_session";
const DEVICE_COOKIE_NAME = "ppic_device_id";

function newDeviceId() {
  // Edge runtime supports crypto.randomUUID().
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function attachDeviceCookie(req: NextRequest, res: NextResponse) {
  const existing = req.cookies.get(DEVICE_COOKIE_NAME)?.value;
  if (existing) return res;

  const id = newDeviceId();
  res.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
  });
  return res;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets in /public (e.g. logo, icons) should be publicly accessible.
  // Otherwise they get redirected to /login and appear as broken images.
  const isPublicAsset = /\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml|map)$/i.test(pathname);
  if (isPublicAsset) {
    return NextResponse.next();
  }

  // Public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return attachDeviceCookie(req, NextResponse.next());
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return attachDeviceCookie(req, NextResponse.redirect(url));
  }

  const secret = getJwtSecret();
  if (!secret) return attachDeviceCookie(req, NextResponse.next());

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role;
    const emailVerified = typeof payload.emailVerified === "boolean" ? payload.emailVerified : true;

    // Force email verification before using the app (except OTP endpoints and logout)
    if (!emailVerified) {
      if (pathname.startsWith("/api/auth/otp/") || pathname.startsWith("/verify-email") || pathname.startsWith("/logout")) {
        return attachDeviceCookie(req, NextResponse.next());
      }
      return attachDeviceCookie(req, NextResponse.redirect(new URL("/verify-email", req.url)));
    }

    // Simple role guard for dashboard areas
    if (pathname.startsWith("/admin") && role !== "ADMIN") return attachDeviceCookie(req, NextResponse.redirect(new URL("/dashboard", req.url)));
    if (pathname.startsWith("/finance") && role !== "FINANCE") return attachDeviceCookie(req, NextResponse.redirect(new URL("/dashboard", req.url)));
    if (pathname.startsWith("/instructor") && role !== "INSTRUCTOR") return attachDeviceCookie(req, NextResponse.redirect(new URL("/dashboard", req.url)));
    if (pathname.startsWith("/user") && role !== "USER") return attachDeviceCookie(req, NextResponse.redirect(new URL("/dashboard", req.url)));

    return attachDeviceCookie(req, NextResponse.next());
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return attachDeviceCookie(req, NextResponse.redirect(url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
