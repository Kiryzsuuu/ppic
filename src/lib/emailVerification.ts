import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;

function getOtpSecret() {
  return process.env.OTP_SECRET || process.env.JWT_SECRET || "dev-otp-secret";
}

export function generateOtpCode(): string {
  // 6-digit numeric code
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string, userId: string): string {
  const secret = getOtpSecret();
  return crypto.createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export async function issueEmailOtp(userId: string) {
  const existing = await prisma.emailVerification.findUnique({
    where: { userId },
    select: { updatedAt: true },
  });

  if (existing) {
    const sinceMs = Date.now() - existing.updatedAt.getTime();
    if (sinceMs >= 0 && sinceMs < OTP_COOLDOWN_SECONDS * 1000) {
      throw new Error(`OTP baru saja dikirim. Coba lagi dalam ${OTP_COOLDOWN_SECONDS} detik.`);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { email: true } } },
  });
  const emailRaw = user?.email ?? user?.profile?.email;
  const email = emailRaw ? emailRaw.trim().toLowerCase() : null;
  if (!email) throw new Error("Email belum diisi. Silakan isi email di profil.");

  const code = generateOtpCode();
  const codeHash = hashOtp(code, userId);

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.emailVerification.upsert({
    where: { userId },
    create: { userId, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 },
  });

  const subject = "Kode OTP Verifikasi Email";
  const text = `Kode OTP Anda: ${code}\nBerlaku selama ${OTP_TTL_MINUTES} menit.\nJika Anda tidak meminta kode ini, abaikan email ini.`;

  const mail = await sendMail({ to: email, subject, text });

  // Helpful for local development
  if (process.env.NODE_ENV !== "production") {
    console.log("[otp:dev] OTP code", { userId, email, code, expiresAt: expiresAt.toISOString() });
  }

  const delivery = mail.delivered ? "sent" : "logged";
  return { expiresAt, delivery };
}

export async function verifyEmailOtp(userId: string, code: string) {
  const record = await prisma.emailVerification.findUnique({ where: { userId } });
  if (!record) throw new Error("OTP belum diminta. Klik Kirim OTP terlebih dahulu.");

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerification.delete({ where: { userId } }).catch(() => null);
    throw new Error("OTP sudah kadaluarsa. Silakan kirim ulang OTP.");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new Error("Terlalu banyak percobaan. Silakan kirim ulang OTP.");
  }

  const expected = record.codeHash;
  const actual = hashOtp(code, userId);

  const ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));

  if (!ok) {
    await prisma.emailVerification.update({ where: { userId }, data: { attempts: { increment: 1 } } });
    throw new Error("OTP salah.");
  }

  const verifiedAt = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: verifiedAt } }),
    prisma.profile.updateMany({
      where: { userId },
      data: {
        status: "APPROVED",
        verifiedAt,
        verifiedById: null,
      },
    }),
    prisma.emailVerification.delete({ where: { userId } }),
  ]);

  return { verifiedAt };
}
