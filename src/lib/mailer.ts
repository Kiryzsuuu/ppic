import nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type MailTransportMode = "smtp" | "ethereal" | "log";

export type SendMailResult = {
  delivered: boolean;
  mode: MailTransportMode;
  previewUrl?: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "");
  const from = process.env.SMTP_FROM?.trim();

  const mode = (process.env.MAIL_TRANSPORT || "smtp").toLowerCase() as MailTransportMode;

  return { host, port, user, pass, from, mode };
}

let cachedSmtpTransport: nodemailer.Transporter | null = null;
let cachedEtherealTransport: nodemailer.Transporter | null = null;

async function getTransport(cfg: ReturnType<typeof getSmtpConfig>) {
  if (cfg.mode === "log") return null;

  if (cfg.mode === "ethereal") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MAIL_TRANSPORT=ethereal tidak diizinkan di production");
    }
    if (cachedEtherealTransport) return cachedEtherealTransport;
    const acc = await nodemailer.createTestAccount();
    cachedEtherealTransport = nodemailer.createTransport({
      host: acc.smtp.host,
      port: acc.smtp.port,
      secure: acc.smtp.secure,
      auth: { user: acc.user, pass: acc.pass },
    });
    return cachedEtherealTransport;
  }

  if (cachedSmtpTransport) return cachedSmtpTransport;
  cachedSmtpTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  return cachedSmtpTransport;
}

export async function sendMail(input: SendMailInput) {
  const cfg = getSmtpConfig();

  const hasCore = Boolean(cfg.host && cfg.port && cfg.from);
  const wantsAuth = Boolean(cfg.user);
  const hasAuth = Boolean(cfg.user && cfg.pass);

  // Explicit log transport always logs and returns.
  if (cfg.mode === "log") {
    console.log("[mailer:log]", { to: input.to, subject: input.subject, text: input.text });
    return { delivered: false, mode: "log" } satisfies SendMailResult;
  }

  // Dev-friendly fallback: if SMTP isn't configured, log to server console.
  if (!hasCore || (wantsAuth && !hasAuth)) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[mailer:dev] SMTP not configured (or missing auth); email logged", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return { delivered: false, mode: "log" } satisfies SendMailResult;
    }

    if (!hasCore) {
      throw new Error("SMTP belum dikonfigurasi (set SMTP_HOST/SMTP_PORT/SMTP_FROM)");
    }
    throw new Error("SMTP auth belum lengkap (set SMTP_USER dan SMTP_PASS)");
  }

  // Extra diagnostics for Gmail SMTP in development.
  if (process.env.NODE_ENV !== "production") {
    const isGmail = (cfg.host || "").toLowerCase().includes("smtp.gmail.com");
    if (isGmail) {
      const passLen = cfg.user && cfg.mode === "smtp" ? (cfg as { pass?: string }).pass?.length ?? 0 : 0;
      if (passLen && passLen !== 16) {
        console.log("[mailer:dev] gmail warning", {
          warning: "Panjang App Password Gmail biasanya 16 karakter (tanpa spasi). Cek SMTP_PASS yang Anda paste.",
          passLength: passLen,
        });
      }

      const fromEmail = (cfg.from || "").match(/<([^>]+)>/)?.[1]?.trim().toLowerCase();
      const userEmail = (cfg.user || "").trim().toLowerCase();
      if (fromEmail && userEmail && fromEmail !== userEmail) {
        console.log("[mailer:dev] gmail warning", {
          warning: "SMTP_FROM sebaiknya memakai email yang sama dengan SMTP_USER (untuk Gmail).",
          smtpUser: userEmail,
          smtpFromEmail: fromEmail,
        });
      }
    }
  }

  const transporter = await getTransport(cfg);
  if (!transporter) {
    console.log("[mailer:log]", { to: input.to, subject: input.subject, text: input.text });
    return { delivered: false, mode: "log" } satisfies SendMailResult;
  }

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (cfg.mode === "ethereal") {
      const url = nodemailer.getTestMessageUrl(info);
      const previewUrl = url ? String(url) : undefined;
      console.log("[mailer:ethereal] sent", { to: input.to, subject: input.subject, previewUrl, text: input.text });
      return { delivered: true, mode: "ethereal", previewUrl } satisfies SendMailResult;
    } else if (cfg.mode === "smtp" && process.env.NODE_ENV !== "production") {
      console.log("[mailer:smtp] sent", { to: input.to, subject: input.subject, messageId: info.messageId });
    }

    return { delivered: true, mode: "smtp" } satisfies SendMailResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (process.env.NODE_ENV !== "production") {
      const isGmail = (cfg.host || "").toLowerCase().includes("smtp.gmail.com");
      const isBadCreds = msg.includes("535-5.7.8") || msg.toLowerCase().includes("badcredentials");

      console.log("[mailer:dev] send failed", {
        reason: msg,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });

      if (isGmail && isBadCreds) {
        console.log("[mailer:dev] gmail hint", {
          hint: "Gmail SMTP menolak kredensial. Biasanya harus pakai App Password (akun harus 2FA), bukan password login biasa. Pastikan SMTP_USER adalah email Gmail lengkap, SMTP_PASS adalah App Password 16 karakter, dan SMTP_FROM memakai alamat yang sama.",
        });

        throw new Error(
          "Gagal mengirim email via Gmail SMTP (BadCredentials). Pastikan: 2-Step Verification aktif, SMTP_PASS adalah App Password (16 karakter), dan App Password-nya masih valid."
        );
      }

      // In development, do not silently succeed when SMTP is configured but fails.
      // This avoids flows (OTP, reset password) saying "terkirim" padahal email gagal dikirim.
      throw new Error("Gagal mengirim email. Periksa konfigurasi SMTP (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM).");
    }
    throw e;
  }
}
