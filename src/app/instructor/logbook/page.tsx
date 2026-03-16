"use client";

import { useEffect, useState } from "react";

type BookingRow = {
  id: string;
  trainingName: string;
  user: { username: string };
  simulator: { category: string; name: string };
  slot: { startAt: string; endAt: string };
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function InstructorLogbookPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("PASS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    const res = await fetch("/api/instructor/bookings");
    const json = (await res.json().catch(() => null)) as ApiRes<{ bookings: BookingRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat data");
      return;
    }
    setBookings(json.data.bookings);
    if (!selectedId && json.data.bookings.length > 0) setSelectedId(json.data.bookings[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/instructor/bookings/${selectedId}/logbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, result }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal simpan logbook");
      setLoading(false);
      return;
    }

    setNotes("");
    setLoading(false);
    await load();
  }

  const current = bookings.find((b) => b.id === selectedId);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logbook (Wet Leased)</h1>
        <p className="mt-1 text-sm text-zinc-600">Pilih booking, lalu isi hasil pelatihan.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Booking</span>
          <select className="h-10 rounded-lg border border-zinc-200 px-3" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.user.username} — {b.simulator.category} {b.simulator.name} — {b.trainingName}
              </option>
            ))}
          </select>
        </label>

        {current ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Jadwal: {new Date(current.slot.startAt).toLocaleString()} - {new Date(current.slot.endAt).toLocaleString()}
          </div>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Hasil</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={result} onChange={(e) => setResult(e.target.value)} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Catatan</span>
          <textarea className="min-h-28 rounded-lg border border-zinc-200 px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button disabled={loading} onClick={submit} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
          {loading ? "Menyimpan..." : "Simpan Logbook"}
        </button>
      </section>

      <div className="text-sm">
        <a className="underline" href="/instructor/dashboard">Kembali ke Dashboard</a>
      </div>
    </div>
  );
}
