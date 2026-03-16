import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MINUTES = 60;

function baseUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetLink(token: string) {
  return `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function issuePasswordResetToken(input: { userId: string }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function consumePasswordResetToken(input: { token: string }) {
  const tokenHash = hashToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record) return { ok: false as const, error: "Token tidak valid" };
  if (record.usedAt) return { ok: false as const, error: "Token sudah digunakan" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "Token kedaluwarsa" };

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { ok: true as const, userId: record.userId };
}
