"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    const json = (await res.json().catch(() => null)) as ApiRes<{ sent: boolean }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal mengirim email reset");
      setLoading(false);
      return;
    }

    const clean = email.trim().toLowerCase();
    try {
      window.sessionStorage.setItem("ppic:pwreset:email", clean);
    } catch {
      // ignore
    }

    setInfo("Jika email terdaftar, OTP reset password sudah dikirim. Mengarahkan...");
    setLoading(false);
    setTimeout(() => {
      router.push("/reset-password");
      router.refresh();
    }, 350);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Forgot Password</h1>
      <p className="mt-1 text-sm text-zinc-600">Masukkan email akun Anda untuk menerima OTP reset password.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-6">
        {info ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            className="h-10 rounded-lg border border-zinc-200 px-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <button
          disabled={loading}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Kirim OTP"}
        </button>

        <div className="text-xs text-zinc-500">
          <Link className="text-zinc-900 underline" href="/login">Kembali ke Login</Link>
        </div>
      </form>
    </div>
  );
}
