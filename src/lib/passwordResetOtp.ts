import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_OTP_TTL_MINUTES = 10;
const RESET_OTP_MAX_ATTEMPTS = 3;
const RESET_OTP_COOLDOWN_SECONDS = 60;

function getOtpSecret() {
  return process.env.OTP_SECRET || process.env.JWT_SECRET || "dev-otp-secret";
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashOtp(code: string, userId: string): string {
  const secret = getOtpSecret();
  return crypto.createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export async function issuePasswordResetOtp(input: { userId: string; email: string }) {
  const existing = await prisma.passwordResetOtp.findUnique({
    where: { userId: input.userId },
    select: { updatedAt: true },
  });

  if (existing) {
    const sinceMs = Date.now() - existing.updatedAt.getTime();
    if (sinceMs >= 0 && sinceMs < RESET_OTP_COOLDOWN_SECONDS * 1000) {
      throw new Error(`OTP baru saja dikirim. Coba lagi dalam ${RESET_OTP_COOLDOWN_SECONDS} detik.`);
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(code, input.userId);
  const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetOtp.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 },
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[pwreset:otp:dev] code", { userId: input.userId, email: input.email, code, expiresAt: expiresAt.toISOString() });
  }

  return { code, expiresAt, ttlMinutes: RESET_OTP_TTL_MINUTES };
}

export async function verifyPasswordResetOtp(input: { userId: string; code: string }) {
  const record = await prisma.passwordResetOtp.findUnique({ where: { userId: input.userId } });
  if (!record) throw new Error("OTP belum diminta. Silakan minta OTP terlebih dahulu.");

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetOtp.delete({ where: { userId: input.userId } }).catch(() => null);
    throw new Error("OTP sudah kadaluarsa. Silakan minta OTP ulang.");
  }

  if (record.attempts >= RESET_OTP_MAX_ATTEMPTS) {
    throw new Error("Terlalu banyak percobaan. Silakan minta OTP ulang.");
  }

  const expected = record.codeHash;
  const actual = hashOtp(input.code, input.userId);
  const ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));

  if (!ok) {
    await prisma.passwordResetOtp.update({ where: { userId: input.userId }, data: { attempts: { increment: 1 } } });
    throw new Error("OTP salah.");
  }

  await prisma.passwordResetOtp.delete({ where: { userId: input.userId } });
  return { verified: true as const };
}
