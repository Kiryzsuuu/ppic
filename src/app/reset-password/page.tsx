"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"OTP" | "NEW_PASSWORD">("OTP");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = attempts >= 3;

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => {
    const raw = code.replace(/\D/g, "").slice(0, 6);
    return Array.from({ length: 6 }, (_, i) => raw[i] ?? "");
  }, [code]);

  function focusAt(i: number) {
    inputsRef.current[i]?.focus();
    inputsRef.current[i]?.select();
  }

  function setDigit(idx: number, v: string) {
    const only = v.replace(/\D/g, "");
    const arr = [...digits];
    arr[idx] = only.slice(-1);
    const merged = arr.join("").replace(/\D/g, "").slice(0, 6);
    setCode(merged);
  }

  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem("ppic:pwreset:email") || "";
      if (v) setEmail(v);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (step !== "OTP") return;
    if (!email.trim()) return;
    setTimeout(() => focusAt(0), 0);
  }, [email, step]);

  useEffect(() => {
    if (step !== "OTP" || locked) return;
    const merged = digits.join("");
    if (merged.length === 6 && !loading) {
      verifyOtp().catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits.join(""), step, locked]);

  async function requestOtp() {
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
      setError(json && !json.ok ? json.error.message : "Gagal mengirim OTP");
      setLoading(false);
      return;
    }

    setInfo("Jika email terdaftar, OTP reset password sudah dikirim.");
    setAttempts(0);
    setCode("");
    focusAt(0);
    setLoading(false);
  }

  async function verifyOtp() {
    if (locked) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    const merged = digits.join("");
    if (merged.length !== 6) {
      setError("Kode OTP harus 6 digit.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/password-reset/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: merged }),
    });

    const json = (await res.json().catch(() => null)) as ApiRes<{ verified: boolean }> | null;
    if (!res.ok || !json || !json.ok) {
      const msg = json && !json.ok ? json.error.message : "OTP salah";
      setError(msg);
      if (msg.toLowerCase().includes("terlalu banyak")) {
        setAttempts(3);
      } else {
        setAttempts((a) => a + 1);
      }
      setCode("");
      focusAt(0);
      setLoading(false);
      return;
    }

    setInfo("OTP benar. Silakan buat password baru.");
    setLoading(false);
    setStep("NEW_PASSWORD");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    const json = (await res.json().catch(() => null)) as ApiRes<{ reset: boolean }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal reset password");
      setLoading(false);
      return;
    }

    setInfo("Password berhasil direset. Mengarahkan ke login...");
    setLoading(false);
    try {
      window.sessionStorage.removeItem("ppic:pwreset:email");
    } catch {
      // ignore
    }
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 700);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
      <p className="mt-1 text-sm text-zinc-600">Verifikasi OTP, lalu buat password baru.</p>

      {step === "OTP" ? (
        <div className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-6">
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
              disabled={loading}
            />
          </label>

          <div className="grid gap-1 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium">Kode OTP (6 digit)</div>
              <div className="text-xs text-zinc-500">Percobaan: {attempts}/3</div>
            </div>

            <div className="mt-1 flex items-center gap-2">
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  inputMode="numeric"
                  pattern="\\d*"
                  maxLength={1}
                  disabled={loading || locked}
                  className="h-11 w-11 rounded-xl border border-zinc-200 text-center text-lg tracking-widest disabled:bg-zinc-50"
                  value={d}
                  onChange={(e) => {
                    setDigit(idx, e.target.value);
                    if (e.target.value && idx < 5) focusAt(idx + 1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[idx] && idx > 0) focusAt(idx - 1);
                    if (e.key === "ArrowLeft" && idx > 0) focusAt(idx - 1);
                    if (e.key === "ArrowRight" && idx < 5) focusAt(idx + 1);
                  }}
                  onPaste={(e) => {
                    const txt = e.clipboardData.getData("text");
                    const only = txt.replace(/\D/g, "").slice(0, 6);
                    if (!only) return;
                    e.preventDefault();
                    setCode(only);
                    const nextIdx = Math.min(only.length, 5);
                    setTimeout(() => focusAt(nextIdx), 0);
                  }}
                />
              ))}
            </div>

            {locked ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Terlalu banyak percobaan. Silakan klik "Kirim Ulang OTP" untuk mendapatkan kode baru.
              </div>
            ) : (
              <div className="mt-1 text-xs text-zinc-500">Kode akan diverifikasi otomatis saat 6 digit terisi.</div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              disabled={loading || !email.trim()}
              onClick={requestOtp}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              Kirim Ulang OTP
            </button>
            <button
              disabled={loading || locked || digits.join("").length !== 6}
              onClick={verifyOtp}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Verifikasi
            </button>
          </div>

          <div className="text-xs text-zinc-500">
            <Link className="text-zinc-900 underline" href="/forgot-password">Kembali</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-6">
          {info ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Password Baru</span>
            <input
              type="password"
              className="h-10 rounded-lg border border-zinc-200 px-3"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Konfirmasi Password</span>
            <input
              type="password"
              className="h-10 rounded-lg border border-zinc-200 px-3"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <button
            disabled={loading}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Simpan Password"}
          </button>
        </form>
      )}
    </div>
  );
}
