import { sendMail } from "@/lib/mailer";
import { getAppBaseUrl, renderBaseEmail } from "@/lib/emailTemplates";

const WIB_TZ = "Asia/Jakarta";

function formatWibDateTime(dt: Date) {
  const d = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `${d} WIB`;
}

function formatWibTime(dt: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
}

export async function sendWelcomeEmail(input: { to: string; name?: string | null }) {
  const name = input.name?.trim() || "";
  const greet = name ? `Halo ${name},` : "Halo,";
  const subject = "Selamat Datang di PPI Curug Simulator Training";
  const text = `${greet}\n\nAkun Anda sudah terverifikasi. Silakan login dan lakukan booking simulator sesuai kebutuhan.\n\nTerima kasih.\nPPI Curug Simulator Training`;

  const baseUrl = getAppBaseUrl();
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: "Akun Anda sudah terverifikasi.",
    sections: [
      {
        lines: ["Silakan login dan lakukan booking simulator sesuai kebutuhan."],
      },
    ],
    cta: baseUrl ? { label: "Buka Dashboard", href: `${baseUrl}/dashboard` } : undefined,
  });

  await sendMail({ to: input.to, subject, text, html });
}

export async function sendBookingCreatedEmail(input: {
  to: string;
  name?: string | null;
  bookingId: string;
  simulatorLabel: string;
  trainingName: string;
  leaseType: string;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = "Booking Anda Berhasil Dibuat";
  const text = `${greet}\n\nBooking berhasil dibuat.\nID Booking: ${input.bookingId}\nSimulator: ${input.simulatorLabel}\nTraining: ${input.trainingName}\nSkema: ${input.leaseType}\n\nSilakan pantau status booking di dashboard.\nPPI Curug Simulator Training`;
  const baseUrl = getAppBaseUrl();
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: "Booking berhasil dibuat.",
    sections: [
      {
        title: "Detail booking",
        lines: [
          `ID Booking: ${input.bookingId}`,
          `Simulator: ${input.simulatorLabel}`,
          `Training: ${input.trainingName}`,
          `Skema: ${input.leaseType}`,
        ],
      },
      {
        lines: ["Silakan pantau status booking di dashboard."],
      },
    ],
    cta: baseUrl ? { label: "Buka Dashboard", href: `${baseUrl}/dashboard` } : undefined,
  });

  await sendMail({ to: input.to, subject, text, html });
}

export async function sendPaymentSubmittedEmail(input: {
  to: string;
  name?: string | null;
  bookingId: string;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = "Bukti Pembayaran Diterima";
  const text = `${greet}\n\nBukti pembayaran untuk booking ${input.bookingId} sudah kami terima dan sedang menunggu validasi.\n\nPPI Curug Simulator Training`;
  const baseUrl = getAppBaseUrl();
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: `Bukti pembayaran untuk booking ${input.bookingId} sudah kami terima dan sedang menunggu validasi.`,
    cta: baseUrl ? { label: "Buka Dashboard", href: `${baseUrl}/dashboard` } : undefined,
  });
  await sendMail({ to: input.to, subject, text, html });
}

export async function sendPaymentValidatedEmail(input: {
  to: string;
  name?: string | null;
  bookingId: string;
  approved: boolean;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = input.approved ? "Pembayaran Tervalidasi" : "Pembayaran Ditolak";
  const statusText = input.approved
    ? "Pembayaran Anda telah tervalidasi. Booking Anda akan diproses untuk penjadwalan."
    : "Pembayaran Anda ditolak. Silakan unggah ulang bukti pembayaran.";
  const text = `${greet}\n\n${statusText}\nID Booking: ${input.bookingId}\n\nPPI Curug Simulator Training`;
  const baseUrl = getAppBaseUrl();
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: statusText,
    sections: [
      {
        title: "Referensi",
        lines: [`ID Booking: ${input.bookingId}`],
      },
    ],
    cta: baseUrl ? { label: "Buka Dashboard", href: `${baseUrl}/dashboard` } : undefined,
  });
  await sendMail({ to: input.to, subject, text, html });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  resetLink: string;
  expiresMinutes: number;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = "Reset Password PPI Curug Simulator Training";
  const text = `${greet}\n\nKami menerima permintaan reset password akun Anda.\n\nBuka link berikut untuk membuat password baru (berlaku ${input.expiresMinutes} menit):\n${input.resetLink}\n\nJika Anda tidak merasa meminta reset password, abaikan email ini.\n\nPPI Curug Simulator Training`;
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: "Kami menerima permintaan reset password akun Anda.",
    sections: [
      {
        lines: [`Link reset password berlaku ${input.expiresMinutes} menit.`],
      },
      {
        lines: ["Jika Anda tidak merasa meminta reset password, abaikan email ini."],
      },
    ],
    cta: { label: "Reset Password", href: input.resetLink },
  });
  await sendMail({ to: input.to, subject, text, html });
}

export async function sendPasswordResetOtpEmail(input: {
  to: string;
  name?: string | null;
  code: string;
  expiresMinutes: number;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = "Kode OTP Reset Password";
  const text = `${greet}\n\nKode OTP reset password Anda: ${input.code}\nBerlaku selama ${input.expiresMinutes} menit.\n\nJika Anda tidak merasa meminta reset password, abaikan email ini.\n\nPPI Curug Simulator Training`;
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: "Gunakan kode OTP berikut untuk reset password Anda:",
    sections: [
      {
        title: "Kode OTP",
        lines: [input.code, `Berlaku selama ${input.expiresMinutes} menit.`],
      },
      {
        lines: ["Jika Anda tidak merasa meminta reset password, abaikan email ini."],
      },
    ],
  });
  await sendMail({ to: input.to, subject, text, html });
}

export async function sendSimulatorReminderEmail(input: {
  to: string;
  name?: string | null;
  bookingId: string;
  simulatorLabel: string;
  trainingName: string;
  leaseType: string;
  startAt: Date;
  endAt?: Date | null;
  daysBefore: 0 | 1 | 2 | 3;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";

  const subject =
    input.daysBefore === 0
      ? "Pengingat Hari H: Jadwal Simulator Anda"
      : `Pengingat H-${input.daysBefore}: Jadwal Simulator Anda`;

  const when = input.endAt
    ? `${formatWibDateTime(input.startAt)} – ${formatWibTime(input.endAt)}`
    : formatWibDateTime(input.startAt);

  const text = `${greet}\n\nIni adalah pengingat jadwal simulator Anda (H-${input.daysBefore}).\n\nID Booking: ${input.bookingId}\nSimulator: ${input.simulatorLabel}\nTraining: ${input.trainingName}\nSkema: ${input.leaseType}\nJadwal: ${when}\n\nMohon hadir tepat waktu.\nPPI Curug Simulator Training`;

  const baseUrl = getAppBaseUrl();
  const html = renderBaseEmail({
    subject,
    greeting: greet,
    intro: input.daysBefore === 0 ? "Ini adalah pengingat jadwal simulator Anda (Hari H)." : `Ini adalah pengingat jadwal simulator Anda (H-${input.daysBefore}).`,
    sections: [
      {
        title: "Jadwal",
        lines: [when],
      },
      {
        title: "Detail booking",
        lines: [
          `ID Booking: ${input.bookingId}`,
          `Simulator: ${input.simulatorLabel}`,
          `Training: ${input.trainingName}`,
          `Skema: ${input.leaseType}`,
        ],
      },
      {
        lines: ["Mohon hadir tepat waktu."],
      },
    ],
    cta: baseUrl ? { label: "Buka Dashboard", href: `${baseUrl}/dashboard` } : undefined,
  });

  await sendMail({ to: input.to, subject, text, html });
}
