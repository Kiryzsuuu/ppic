"use client";

import { useMemo, useState } from "react";

type Props = {
  email: string | null;
  emailVerifiedAt: string | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function EmailVerificationPanel({ email, emailVerifiedAt }: Props) {
  const [code, setCode] = useState("");
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateTimeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
  }, []);

  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? dateTimeFormatter.format(d) : iso;
  }

  const isVerified = Boolean(emailVerifiedAt);

  async function sendOtp() {
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Email belum diisi. Silakan isi email di Edit Profil.");
      return;
    }

    setLoadingSend(true);
    try {
      const res = await fetch("/api/auth/otp/request", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiRes<{ expiresAt: string; delivery?: "sent" | "logged" }> | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : "Gagal mengirim OTP");
        return;
      }

      if (json.data.delivery === "logged") {
        setMessage("SMTP belum dikonfigurasi. OTP ditampilkan di log server (terminal) untuk mode development.");
      } else {
        setMessage("OTP terkirim ke email. Silakan cek inbox/spam.");
      }
    } finally {
      setLoadingSend(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Masukkan kode OTP.");
      return;
    }

    setLoadingVerify(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const json = (await res.json().catch(() => null)) as ApiRes<{ verified: boolean }> | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : "Verifikasi gagal");
        return;
      }

      setMessage("Email berhasil terverifikasi.");
      // Refresh server components
      window.location.reload();
    } finally {
      setLoadingVerify(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm font-medium">Verifikasi Email (OTP)</div>
      <div className="mt-1 text-sm text-zinc-600">
        Email: <span className="font-medium">{email ?? "-"}</span> • Status: <span className="font-medium">{isVerified ? "TERVERIFIKASI" : "BELUM"}</span>
      </div>

      {isVerified ? (
        <div className="mt-2 text-xs text-zinc-500">Terverifikasi pada: {emailVerifiedAt ? fmtDateTime(emailVerifiedAt) : "-"}</div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={loadingSend}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              {loadingSend ? "Mengirim..." : "Kirim OTP"}
            </button>
          </div>

          <form onSubmit={verifyOtp} className="mt-3 grid gap-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Kode OTP</span>
              <input
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                placeholder="Masukkan 6 digit kode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button
              disabled={loadingVerify}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {loadingVerify ? "Memverifikasi..." : "Verifikasi"}
            </button>
          </form>
        </>
      )}

      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
    </div>
  );
}
