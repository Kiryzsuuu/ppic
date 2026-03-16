"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatFieldErrors(details: unknown): string | null {
  const fieldErrors = (details as { fieldErrors?: unknown } | null | undefined)?.fieldErrors as
    | Record<string, string[] | undefined>
    | undefined;
  if (!fieldErrors) return null;

  const parts: string[] = [];
  for (const [field, msgs] of Object.entries(fieldErrors)) {
    if (!msgs || msgs.length === 0) continue;
    parts.push(`${field}: ${msgs[0]}`);
  }

  return parts.length ? parts.join("\n") : null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [ktpNumber, setKtpNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me");
      if (cancelled) return;
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        router.replace("/");
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!fullName.trim() || !email.trim() || !phone.trim() || !placeOfBirth.trim() || !dateOfBirth || !address.trim() || !ktpNumber.trim()) {
      setError("Mohon lengkapi data diri terlebih dahulu.");
      setLoading(false);
      return;
    }

    const usernameTrim = username.trim();
    if (usernameTrim.length < 3 || usernameTrim.length > 32 || !/^[a-zA-Z0-9_]+$/.test(usernameTrim)) {
      setError("Username minimal 3 karakter dan hanya boleh huruf/angka/underscore (_).");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      setLoading(false);
      return;
    }

    const payload = {
      fullName,
      email,
      phone,
      placeOfBirth,
      dateOfBirth,
      address,
      ktpNumber,
      username,
      password,
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detailsText = formatFieldErrors(json?.error?.details);
      setError(detailsText ? `${json?.error?.message ?? "Registrasi gagal"}\n${detailsText}` : (json?.error?.message ?? "Registrasi gagal"));
      setLoading(false);
      return;
    }

    router.push("/verify-email");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Registrasi</h1>
      <p className="mt-1 text-sm text-zinc-600">Lengkapi data dasar untuk membuat akun. Upload foto profil dan dokumen bisa dilakukan setelah login di menu Edit Profil.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Nama Lengkap</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input type="email" className="h-10 rounded-lg border border-zinc-200 px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">No. Telepon</span>
            <input className="h-10 rounded-lg border border-zinc-200 px-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tempat Lahir</span>
            <input className="h-10 rounded-lg border border-zinc-200 px-3" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tanggal Lahir</span>
            <input type="date" className="h-10 rounded-lg border border-zinc-200 px-3" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Alamat</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">No. KTP (NIK)</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={ktpNumber} onChange={(e) => setKtpNumber(e.target.value)} />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Username</span>
            <input className="h-10 rounded-lg border border-zinc-200 px-3" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input type="password" className="h-10 rounded-lg border border-zinc-200 px-3" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <button disabled={loading} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
          {loading ? "Memproses..." : "Buat Akun"}
        </button>

        <div className="text-xs text-zinc-500">
          Sudah punya akun? <a className="text-zinc-900 underline" href="/login">Login</a>
        </div>
      </form>
    </div>
  );
}
