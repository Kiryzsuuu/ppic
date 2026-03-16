"use client";

import { useEffect, useState } from "react";

type Simulator = { id: string; category: string; name: string };

type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  simulator: Simulator;
  booking?: { id: string; user?: { username: string } } | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function AdminSchedulePage() {
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [simulators, setSimulators] = useState<Simulator[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [simulatorId, setSimulatorId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [bulkUntilDate, setBulkUntilDate] = useState("");
  const [bulkRepeatUnit, setBulkRepeatUnit] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">("DAY");
  const [bulkRepeatEvery, setBulkRepeatEvery] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<string | null>(null);

  function mapApiMessage(msg: string) {
    if (msg.includes("startAt harus < endAt")) return "Waktu mulai harus lebih awal dari waktu selesai.";
    return msg;
  }

  async function loadSimulators() {
    const res = await fetch("/api/simulators");
    const json = (await res.json().catch(() => null)) as ApiRes<{ simulators: Simulator[] }> | null;
    if (res.ok && json?.ok) {
      setSimulators(json.data.simulators);
      if (!simulatorId && json.data.simulators.length > 0) setSimulatorId(json.data.simulators[0].id);
    }
  }

  async function loadSlots(simId?: string) {
    const id = simId ?? simulatorId;
    if (!id) return;
    const res = await fetch(`/api/admin/slots?simulatorId=${encodeURIComponent(id)}`);
    const json = (await res.json().catch(() => null)) as ApiRes<{ slots: Slot[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(mapApiMessage(json && !json.ok ? json.error.message : "Gagal memuat slots"));
      return;
    }
    setError(null);
    setSlots(json.data.slots);
  }

  useEffect(() => {
    loadSimulators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulatorId]);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBulkResult(null);

    if (!simulatorId) {
      setError("Pilih simulator terlebih dahulu.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Pilih waktu Start dan End terlebih dahulu.");
      return;
    }
    const s = new Date(startAt);
    const en = new Date(endAt);
    if (!(s < en)) {
      setError("Waktu mulai harus lebih awal dari waktu selesai.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulatorId, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(mapApiMessage(json?.error?.message ?? "Gagal membuat slot"));
      setLoading(false);
      return;
    }

    setStartAt("");
    setEndAt("");
    await loadSlots();
    setLoading(false);
  }

  async function createBulkSlots(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBulkResult(null);

    if (!simulatorId) {
      setError("Pilih simulator terlebih dahulu.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Pilih waktu Start dan End terlebih dahulu.");
      return;
    }
    if (!bulkUntilDate) {
      setError("Pilih sampai tanggal terlebih dahulu.");
      return;
    }

    const everyInt = Number.parseInt(bulkRepeatEvery.trim() || "1", 10);
    if (!Number.isFinite(everyInt) || everyInt < 1) {
      setError("Repeat setiap harus angka >= 1.");
      return;
    }

    const s = new Date(startAt);
    const en = new Date(endAt);
    if (!(s < en)) {
      setError("Waktu mulai harus lebih awal dari waktu selesai.");
      return;
    }

    setBulkLoading(true);

    const res = await fetch("/api/admin/slots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulatorId,
        startAt: s.toISOString(),
        endAt: en.toISOString(),
        untilDate: bulkUntilDate,
        repeatUnit: bulkRepeatUnit,
        repeatEvery: everyInt,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(mapApiMessage(json?.error?.message ?? "Gagal membuat slot berulang"));
      setBulkLoading(false);
      return;
    }

    const created = json?.data?.created ?? 0;
    const skipped = json?.data?.skippedConflict ?? 0;
    const stopped = Boolean(json?.data?.stoppedByLimit);

    setBulkResult(
      `Berhasil membuat ${created} slot. Dilewati (bentrok): ${skipped}.` +
        (stopped ? " (Dibatasi oleh limit sistem)" : "")
    );
    await loadSlots();
    setBulkLoading(false);
  }

  function toLocalInputValue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  async function startEdit(slot: Slot) {
    setEditingId(slot.id);
    setEditStartAt(toLocalInputValue(slot.startAt));
    setEditEndAt(toLocalInputValue(slot.endAt));
  }

  async function saveEdit(slotId: string) {
    setError(null);
    setLoading(true);

    if (!editStartAt || !editEndAt) {
      setError("Pilih waktu Start dan End terlebih dahulu.");
      setLoading(false);
      return;
    }
    const s = new Date(editStartAt);
    const en = new Date(editEndAt);
    if (!(s < en)) {
      setError("Waktu mulai harus lebih awal dari waktu selesai.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/admin/slots/${slotId}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startAt: new Date(editStartAt).toISOString(), endAt: new Date(editEndAt).toISOString() }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(mapApiMessage(json?.error?.message ?? "Gagal menyimpan perubahan"));
      setLoading(false);
      return;
    }
    setEditingId(null);
    setEditStartAt("");
    setEditEndAt("");
    await loadSlots();
    setLoading(false);
  }

  async function deleteSlot(slotId: string) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/slots/${slotId}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal delete slot");
      setLoading(false);
      return;
    }
    setConfirmDeleteSlotId(null);
    await loadSlots();
    setLoading(false);
  }

  async function cancelBooking(slotId: string) {
    if (!confirm("Cancel booking pada slot ini?")) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/slots/${slotId}/cancel`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal cancel booking");
      setLoading(false);
      return;
    }
    await loadSlots();
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen Slot Jadwal</h1>
          <p className="mt-1 text-sm text-zinc-600">Buat slot availability dan pantau status booking.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">Kembali</a>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {bulkResult ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {bulkResult}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-4">
        <div className="text-sm font-semibold">Buat Slot</div>
        <form onSubmit={createSlot} className="grid gap-3 md:grid-cols-3 md:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Simulator</span>
            <select className="h-10 rounded-lg border border-zinc-200 px-3" value={simulatorId} onChange={(e) => setSimulatorId(e.target.value)}>
              {simulators.map((s) => (
                <option key={s.id} value={s.id}>{s.category} {s.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Start</span>
            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">End</span>
            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>
          <button disabled={loading} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-3">
            {loading ? "Menyimpan..." : "Buat Slot"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-4">
        <div className="text-sm font-semibold">Buat Slot Berulang</div>
        <form onSubmit={createBulkSlots} className="grid gap-3 md:grid-cols-4 md:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Simulator</span>
            <select className="h-10 rounded-lg border border-zinc-200 px-3" value={simulatorId} onChange={(e) => setSimulatorId(e.target.value)}>
              {simulators.map((s) => (
                <option key={s.id} value={s.id}>{s.category} {s.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Start (slot pertama)</span>
            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">End (slot pertama)</span>
            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Sampai tanggal (WIB)</span>
            <input type="date" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" value={bulkUntilDate} onChange={(e) => setBulkUntilDate(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Ulangi</span>
            <select className="h-10 rounded-lg border border-zinc-200 px-3" value={bulkRepeatUnit} onChange={(e) => setBulkRepeatUnit(e.target.value as any)}>
              <option value="DAY">Harian</option>
              <option value="WEEK">Mingguan</option>
              <option value="MONTH">Bulanan</option>
              <option value="YEAR">Tahunan</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Setiap</span>
            <input className="h-10 rounded-lg border border-zinc-200 px-3" value={bulkRepeatEvery} onChange={(e) => setBulkRepeatEvery(e.target.value)} placeholder="1" />
          </label>

          <button disabled={bulkLoading} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-4">
            {bulkLoading ? "Menyimpan..." : "Buat Slot Berulang"}
          </button>

          <div className="text-xs text-zinc-500 md:col-span-4">
            Catatan: slot yang bentrok dengan slot lain akan dilewati.
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Daftar Slot</div>
        <div className="mt-4 grid gap-2">
          {slots.length === 0 ? (
            <div className="text-sm text-zinc-600">Belum ada slot.</div>
          ) : (
            slots.map((s) => (
              <div key={s.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{new Date(s.startAt).toLocaleString()} - {new Date(s.endAt).toLocaleString()}</div>
                  <div className="text-xs text-zinc-600">{s.status}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">{s.simulator.category} {s.simulator.name}</div>
                {s.booking ? <div className="mt-2 text-xs text-zinc-600">Booking: {s.booking.id} ({s.booking.user?.username ?? "-"})</div> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    disabled={loading}
                    onClick={() => startEdit(s)}
                    className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Edit Jadwal
                  </button>
                  {s.status === "BOOKED" && s.booking ? (
                    <button
                      disabled={loading}
                      onClick={() => cancelBooking(s.id)}
                      className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                      Cancel Booking
                    </button>
                  ) : null}

                  {s.status !== "BOOKED" && !s.booking ? (
                    confirmDeleteSlotId === s.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-zinc-600">Yakin delete slot ini?</div>
                        <button
                          disabled={loading}
                          onClick={() => setConfirmDeleteSlotId(null)}
                          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                        >
                          Batal
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => deleteSlot(s.id)}
                          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Ya, Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={loading}
                        onClick={() => {
                          setConfirmDeleteSlotId(s.id);
                        }}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                      >
                        Delete Slot
                      </button>
                    )
                  ) : null}
                </div>

                {editingId === s.id ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3 md:items-end">
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">Start</span>
                      <input
                        type="datetime-local"
                        className="h-10 rounded-lg border border-zinc-200 px-3"
                        value={editStartAt}
                        onChange={(e) => setEditStartAt(e.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">End</span>
                      <input
                        type="datetime-local"
                        className="h-10 rounded-lg border border-zinc-200 px-3"
                        value={editEndAt}
                        onChange={(e) => setEditEndAt(e.target.value)}
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={loading}
                        onClick={() => saveEdit(s.id)}
                        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                      >
                        Simpan
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => setEditingId(null)}
                        className="h-10 rounded-lg border border-zinc-200 px-4 text-sm hover:bg-zinc-50 disabled:opacity-60"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
