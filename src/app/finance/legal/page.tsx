"use client";

import { useEffect, useState } from "react";

type BookingRow = {
  id: string;
  status: string;
  leaseType: string;
  trainingName: string;
  user: { username: string };
  simulator: { category: string; name: string };
};

type LegalDocRow = {
  id: string;
  type: string;
  status: string;
  issuedAt: string;
  fileName?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  booking: {
    id: string;
    user: { username: string };
    simulator: { category: string; name: string };
  };
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function FinanceLegalPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDocRow[]>([]);
  const [legalFiles, setLegalFiles] = useState<Record<string, File | null>>({});
  const [amount, setAmount] = useState<string>("1000000");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    const [bookRes, legalRes] = await Promise.all([
      fetch("/api/finance/pending-bookings"),
      fetch("/api/finance/legal-documents"),
    ]);

    const bookJson = (await bookRes.json().catch(() => null)) as ApiRes<{ bookings: BookingRow[] }> | null;
    if (bookRes.ok && bookJson?.ok) setBookings(bookJson.data.bookings);
    else setError(bookJson && !bookJson.ok ? bookJson.error.message : "Gagal memuat booking");

    const legalJson = (await legalRes.json().catch(() => null)) as ApiRes<{ legalDocs: LegalDocRow[] }> | null;
    if (legalRes.ok && legalJson?.ok) setLegalDocs(legalJson.data.legalDocs);
    else setError((prev) => prev ?? (legalJson && !legalJson.ok ? legalJson.error.message : "Gagal memuat dokumen legal"));
  }

  useEffect(() => {
    load();
  }, []);

  async function issue(id: string) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/finance/bookings/${id}/issue-legal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal menerbitkan dokumen");
      setLoading(false);
      return;
    }

    await load();
    setLoading(false);
  }

  async function uploadLegalFile(id: string) {
    const file = legalFiles[id] ?? null;
    if (!file) {
      setError("Pilih file PDF untuk dokumen legal");
      return;
    }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`/api/finance/legal-documents/${id}/upload`, { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal upload dokumen legal");
      setLoading(false);
      return;
    }

    setLegalFiles((m) => ({ ...m, [id]: null }));
    await load();
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dokumen Legal (PKS / Berita Acara)</h1>
          <p className="mt-1 text-sm text-zinc-600">Terbitkan dokumen legal otomatis sesuai tipe registrasi, lalu sistem membuat VA & payment record.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/finance/dashboard">Kembali</a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-3">
        <label className="grid gap-1 text-sm max-w-xs">
          <span className="font-medium">Nominal (Rp)</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="text-xs text-zinc-500">Nominal dipakai untuk membuat Payment + VA. Anda bisa ubah sebelum menerbitkan.</div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Booking Menunggu Dokumen Legal</div>
        <div className="mt-4 grid gap-2">
          {bookings.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada.</div>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-4">
                <div>
                  <div className="text-sm font-medium">{b.user.username}</div>
                  <div className="text-xs text-zinc-600">{b.simulator.category} {b.simulator.name} • {b.leaseType} • {b.trainingName}</div>
                </div>
                <button disabled={loading} onClick={() => issue(b.id)} className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">
                  Terbitkan + Buat VA
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Dokumen Legal Terbit</div>
        <div className="mt-1 text-xs text-zinc-500">Upload file PDF untuk PKS/Berita Acara yang sudah diterbitkan agar bisa dipreview/diunduh.</div>
        <div className="mt-4 grid gap-2">
          {legalDocs.length === 0 ? (
            <div className="text-sm text-zinc-600">Belum ada dokumen legal.</div>
          ) : (
            legalDocs.map((d) => (
              <div key={d.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{d.type}</div>
                  <div className="text-xs text-zinc-600">{d.status}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">{d.booking.user.username} • {d.booking.simulator.category} {d.booking.simulator.name}</div>
                <div className="mt-1 text-xs text-zinc-500">Issued: {new Date(d.issuedAt).toLocaleString()}</div>

                {d.storagePath ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a className="h-9 inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50" href={`/api/finance/legal-documents/${d.id}/download`} target="_blank" rel="noreferrer">
                      Preview PDF
                    </a>
                    <div className="text-xs text-zinc-500">{d.fileName ?? "-"}</div>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      onChange={(e) => setLegalFiles((m) => ({ ...m, [d.id]: e.target.files?.[0] ?? null }))}
                    />
                    <button
                      disabled={loading}
                      onClick={() => uploadLegalFile(d.id)}
                      className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {loading ? "Mengunggah..." : "Upload PDF"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
