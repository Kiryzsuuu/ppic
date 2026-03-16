import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { signSession, setSessionCookie } from "@/lib/session";
import { issueEmailOtp } from "@/lib/emailVerification";

const RegisterSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128),
  fullName: z.string().min(3).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  placeOfBirth: z.string().max(120).optional(),
  dateOfBirth: z.string().optional(),
  ktpNumber: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = RegisterSchema.parse(body);

    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { username: input.username } });
    if (existing) return jsonError("Username sudah digunakan", 409);

    // Email can exist either on User.email or legacy Profile.email.
    // We store normalized lowercase emails, so exact match is enough.
    const existingEmail = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { profile: { is: { email } } }],
      },
      select: { id: true },
    });
    if (existingEmail) return jsonError("Email sudah digunakan", 409);

    const passwordHash = await bcrypt.hash(input.password, 10);

    const createUser = () =>
      prisma.user.create({
        data: {
          username: input.username,
          email,
          passwordHash,
          role: "USER",
          profile: {
            create: {
              registrationType: "PERSONAL",
              fullName: input.fullName,
              email,
              phone: input.phone,
              address: input.address,
              placeOfBirth: input.placeOfBirth,
              dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
              ktpNumber: input.ktpNumber,
              status: "PENDING",
            },
          },
        },
        select: { id: true, username: true, role: true },
      });

    let user: Awaited<ReturnType<typeof createUser>>;
    try {
      user = await createUser();
    } catch (err: unknown) {
      const maybe = err as { code?: unknown; meta?: { target?: unknown } };
      if (maybe?.code === "P2002") {
        const target = Array.isArray(maybe?.meta?.target) ? maybe.meta?.target.join(",") : String(maybe?.meta?.target ?? "");
        if (target.includes("username")) return jsonError("Username sudah digunakan", 409);
        if (target.includes("email")) return jsonError("Email sudah digunakan", 409);
        return jsonError("Data sudah digunakan", 409);
      }
      throw err;
    }

    const token = await signSession({ userId: user.id, username: user.username, role: user.role, emailVerified: false });
    await setSessionCookie(token);

    // Best-effort: send OTP email for verification
    try {
      await issueEmailOtp(user.id);
    } catch {
      // Ignore mail failures; user can request OTP from dashboard
    }

    return jsonOk({ user });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
