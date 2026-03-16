"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
  type LoginRes = { user: { id: string; username: string; role: string; emailVerified: boolean } };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Login gagal");
      setLoading(false);
      return;
    }

    const parsed = json as ApiRes<LoginRes> | null;
    const emailVerified = Boolean(parsed && parsed.ok && parsed.data.user.emailVerified);
    router.push(emailVerified ? next : "/verify-email");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-1 text-sm text-zinc-600">Masuk ke sistem PPI Curug Simulator Training.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-6">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Username atau Email</span>
          <input
            className="h-10 rounded-lg border border-zinc-200 px-3"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            className="h-10 rounded-lg border border-zinc-200 px-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <button
          disabled={loading}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Login"}
        </button>

        <div className="text-xs text-zinc-500">
          Belum punya akun? <Link className="text-zinc-900 underline" href="/register">Register</Link>
        </div>

        <div className="text-xs text-zinc-500">
          Lupa password? <Link className="text-zinc-900 underline" href="/forgot-password">Reset via email</Link>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          Akun seed (dev): <span className="font-medium">admin/admin123</span>, <span className="font-medium">finance/finance123</span>,{" "}
          <span className="font-medium">instructor/instructor123</span>
        </div>
      </form>
    </div>
  );
}
