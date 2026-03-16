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

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/pending");
    const json = (await res.json().catch(() => null)) as ApiRes<{ bookings: BookingRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat data");
      return;
    }
    setBookings(json.data.bookings);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${id}/approve`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal approve");
      setLoading(false);
      return;
    }
    await load();
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Booking (Admin Approval)</h1>
          <p className="mt-1 text-sm text-zinc-600">Approve booking yang menunggu verifikasi Admin.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">Kembali</a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="grid gap-3">
          {bookings.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada booking menunggu approve.</div>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-4">
                <div>
                  <div className="text-sm font-medium">{b.user.username}</div>
                  <div className="text-xs text-zinc-600">{b.simulator.category} {b.simulator.name} • {b.leaseType} • {b.trainingName}</div>
                </div>
                <button disabled={loading} onClick={() => approve(b.id)} className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">
                  Approve
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
