import { sendMail } from "@/lib/mailer";

export async function sendWelcomeEmail(input: { to: string; name?: string | null }) {
  const name = input.name?.trim() || "";
  const greet = name ? `Halo ${name},` : "Halo,";
  const subject = "Selamat Datang di PPI Curug Simulator Training";
  const text = `${greet}\n\nAkun Anda sudah terverifikasi. Silakan login dan lakukan booking simulator sesuai kebutuhan.\n\nTerima kasih.\nPPI Curug Simulator Training`;
  await sendMail({ to: input.to, subject, text });
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
  await sendMail({ to: input.to, subject, text });
}

export async function sendPaymentSubmittedEmail(input: {
  to: string;
  name?: string | null;
  bookingId: string;
}) {
  const greet = input.name?.trim() ? `Halo ${input.name.trim()},` : "Halo,";
  const subject = "Bukti Pembayaran Diterima";
  const text = `${greet}\n\nBukti pembayaran untuk booking ${input.bookingId} sudah kami terima dan sedang menunggu validasi.\n\nPPI Curug Simulator Training`;
  await sendMail({ to: input.to, subject, text });
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
  await sendMail({ to: input.to, subject, text });
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
  await sendMail({ to: input.to, subject, text });
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
  await sendMail({ to: input.to, subject, text });
}
