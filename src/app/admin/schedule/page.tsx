"use client";

import { useEffect, useMemo, useState } from "react";
import SchedulePreview from "../../SchedulePreview";
import { WET_SESSIONS_WIB, getWetSessionKeyForRange, toWibMinutes } from "@/lib/schedule";

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

type UserLite = {
  id: string;
  username: string;
  email?: string | null;
  profile?: { fullName: string } | null;
};

export default function AdminSchedulePage() {
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [staffResult, setStaffResult] = useState<string | null>(null);
  const [simulators, setSimulators] = useState<Simulator[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [simulatorId, setSimulatorId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [bulkUntilDate, setBulkUntilDate] = useState("");
  const [bulkRepeatUnit, setBulkRepeatUnit] = useState<"WEEK" | "MONTH">("WEEK");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<string | null>(null);

  // Calendar view
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const [staffLeaseType, setStaffLeaseType] = useState<"WET" | "DRY">("WET");
  const [staffUserId, setStaffUserId] = useState<string>("");
  const [staffDateKey, setStaffDateKey] = useState<string>("");

  // WET
  const [staffWetSessionKey, setStaffWetSessionKey] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [staffTrainingCode, setStaffTrainingCode] = useState<"PPC" | "TYPE_RATING" | "OTHER">("PPC");
  const [staffTrainingName, setStaffTrainingName] = useState<string>("Pilot Proficiency Training (PPC)");
  const [staffPersonCount, setStaffPersonCount] = useState<1 | 2>(1);

  // DRY
  const [staffDeviceType, setStaffDeviceType] = useState<"FFS" | "FTD">("FFS");
  const [staffDrySessionKey, setStaffDrySessionKey] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [staffStartMin, setStaffStartMin] = useState<number>(7 * 60 + 30);
  const [staffEndMin, setStaffEndMin] = useState<number>(8 * 60 + 30);
  const [staffBooking, setStaffBooking] = useState(false);

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

  async function loadUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users?take=500");
    const json = (await res.json().catch(() => null)) as ApiRes<{ users: UserLite[] }> | null;
    if (res.ok && json?.ok) setUsers(json.data.users);
    setUsersLoading(false);
  }

  function todayWibDateKey() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  }

  function fmtMin(m: number) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function dryStartOptions(sessionKey: "MORNING" | "AFTERNOON") {
    return sessionKey === "MORNING"
      ? [7 * 60 + 30, 8 * 60 + 30, 9 * 60 + 30, 10 * 60 + 30]
      : [11 * 60 + 45, 12 * 60 + 45, 13 * 60 + 45, 14 * 60 + 45];
  }

  function dryEndOptions(sessionKey: "MORNING" | "AFTERNOON") {
    return sessionKey === "MORNING"
      ? [8 * 60 + 30, 9 * 60 + 30, 10 * 60 + 30, 11 * 60 + 30]
      : [12 * 60 + 45, 13 * 60 + 45, 14 * 60 + 45, 15 * 60 + 45];
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
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!staffDateKey) setStaffDateKey(todayWibDateKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!staffUserId && users.length > 0) setStaffUserId(users[0].id);
  }, [staffUserId, users]);

  useEffect(() => {
    // keep DRY range valid when session changes
    const starts = dryStartOptions(staffDrySessionKey);
    const ends = dryEndOptions(staffDrySessionKey);
    if (!starts.includes(staffStartMin)) setStaffStartMin(starts[0]);
    if (!ends.includes(staffEndMin) || staffEndMin <= staffStartMin) {
      const nextEnd = ends.find((e) => e > staffStartMin) ?? ends[0];
      setStaffEndMin(nextEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffDrySessionKey, staffStartMin]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, typeof slots> = {};
    for (const s of slots) {
      const key = new Date(s.startAt).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [slots]);

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
    if (!bulkUntilDate) {
      setError("Pilih sampai tanggal terlebih dahulu.");
      return;
    }

    setBulkLoading(true);

    const res = await fetch("/api/admin/slots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulatorId,
        untilDate: bulkUntilDate,
        repeatUnit: bulkRepeatUnit,
        workdaysOnly: true,
        autoGenerateHourly: true,
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

  async function staffBook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBulkResult(null);
    setStaffResult(null);

    if (!staffUserId) {
      setError("Pilih user terlebih dahulu.");
      return;
    }
    if (!simulatorId) {
      setError("Pilih simulator terlebih dahulu.");
      return;
    }
    if (!staffDateKey) {
      setError("Pilih tanggal terlebih dahulu.");
      return;
    }

    if (staffLeaseType === "WET" && !staffTrainingName.trim()) {
      setError("Training Name wajib diisi untuk WET.");
      return;
    }

    setStaffBooking(true);

    const payload =
      staffLeaseType === "WET"
        ? {
            leaseType: "WET" as const,
            userId: staffUserId,
            simulatorId,
            dateKey: staffDateKey,
            sessionKey: staffWetSessionKey,
            trainingCode: staffTrainingCode,
            trainingName: staffTrainingName.trim(),
            personCount: staffPersonCount,
          }
        : {
            leaseType: "DRY" as const,
            userId: staffUserId,
            simulatorId,
            dateKey: staffDateKey,
            deviceType: staffDeviceType,
            startMin: staffStartMin,
            endMin: staffEndMin,
          };

    const res = await fetch("/api/admin/bookings/staff-book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(mapApiMessage(json?.error?.message ?? "Gagal booking"));
      setStaffBooking(false);
      return;
    }

    await loadSlots();
    setStaffResult("Booking berhasil dibuat (langsung CONFIRMED).");
    setStaffBooking(false);
  }

  return (
    <div className="grid gap-6">
      <SchedulePreview authed={true} />

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

      <section id="staff-booking" className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-4">
        <div className="text-sm font-semibold">Booking untuk User</div>

        {staffResult ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {staffResult}
          </div>
        ) : null}

        <form onSubmit={staffBook} className="grid gap-3 md:grid-cols-6 md:items-end">
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">User</span>
            <select
              className="h-10 w-full min-w-0 truncate rounded-lg border border-zinc-200 bg-white px-3"
              value={staffUserId}
              onChange={(e) => setStaffUserId(e.target.value)}
              disabled={usersLoading || staffBooking}
            >
              <option value="" disabled>
                {usersLoading ? "Memuat user..." : "Pilih user"}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.profile?.fullName ? `${u.profile.fullName} — ` : ""}
                  {u.username}
                  {u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Simulator</span>
            <select
              className="h-10 w-full min-w-0 truncate rounded-lg border border-zinc-200 px-3"
              value={simulatorId}
              onChange={(e) => setSimulatorId(e.target.value)}
              disabled={staffBooking}
            >
              {simulators.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category} {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Leased Type</span>
            <select
              className="h-10 w-full min-w-0 truncate rounded-lg border border-zinc-200 px-3"
              value={staffLeaseType}
              onChange={(e) => setStaffLeaseType(e.target.value as "WET" | "DRY")}
              disabled={staffBooking}
            >
              <option value="WET">Wet Leased</option>
              <option value="DRY">Dry Leased</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">Tanggal (WIB)</span>
            <input
              type="date"
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
              value={staffDateKey}
              onChange={(e) => setStaffDateKey(e.target.value)}
              disabled={staffBooking}
            />
          </label>

          {staffLeaseType === "WET" ? (
            <>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Sesi</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffWetSessionKey}
                  onChange={(e) => setStaffWetSessionKey(e.target.value as "MORNING" | "AFTERNOON")}
                  disabled={staffBooking}
                >
                  <option value="MORNING">Morning ({fmtMin(WET_SESSIONS_WIB.MORNING.startMin)}–{fmtMin(WET_SESSIONS_WIB.MORNING.endMin)})</option>
                  <option value="AFTERNOON">Afternoon ({fmtMin(WET_SESSIONS_WIB.AFTERNOON.startMin)}–{fmtMin(WET_SESSIONS_WIB.AFTERNOON.endMin)})</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Person</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffPersonCount}
                  onChange={(e) => setStaffPersonCount((Number(e.target.value) as 1 | 2) ?? 1)}
                  disabled={staffBooking}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Training</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffTrainingCode}
                  onChange={(e) => {
                    const v = e.target.value as "PPC" | "TYPE_RATING" | "OTHER";
                    setStaffTrainingCode(v);
                    setStaffTrainingName(
                      v === "PPC" ? "Pilot Proficiency Training (PPC)" : v === "TYPE_RATING" ? "Initial Type Rating" : staffTrainingName,
                    );
                  }}
                  disabled={staffBooking}
                >
                  <option value="PPC">PPC</option>
                  <option value="TYPE_RATING">Type Rating</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-4">
                <span className="font-medium">Training Name</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffTrainingName}
                  onChange={(e) => setStaffTrainingName(e.target.value)}
                  disabled={staffBooking}
                />
              </label>
            </>
          ) : (
            <>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Sesi DRY</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffDrySessionKey}
                  onChange={(e) => setStaffDrySessionKey(e.target.value as "MORNING" | "AFTERNOON")}
                  disabled={staffBooking}
                >
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Device</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={staffDeviceType}
                  onChange={(e) => setStaffDeviceType(e.target.value as "FFS" | "FTD")}
                  disabled={staffBooking}
                >
                  <option value="FFS">FFS</option>
                  <option value="FTD">FTD</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Mulai</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={String(staffStartMin)}
                  onChange={(e) => setStaffStartMin(Number(e.target.value))}
                  disabled={staffBooking}
                >
                  {dryStartOptions(staffDrySessionKey).map((m) => (
                    <option key={m} value={String(m)}>
                      {fmtMin(m)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Selesai</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                  value={String(staffEndMin)}
                  onChange={(e) => setStaffEndMin(Number(e.target.value))}
                  disabled={staffBooking}
                >
                  {dryEndOptions(staffDrySessionKey)
                    .filter((m) => m > staffStartMin)
                    .map((m) => (
                      <option key={m} value={String(m)}>
                        {fmtMin(m)}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}

          <button
            disabled={staffBooking || usersLoading}
            className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-2"
          >
            {staffBooking ? "Memproses..." : "Booking"}
          </button>
        </form>

        <div className="text-xs text-zinc-500">
          Catatan: booking staff akan langsung membuat booking status CONFIRMED. Untuk WET, idealnya slot sesi (Morning/Afternoon) sudah tersedia (AVAILABLE). Jika yang tersedia slot full-day 07:30–15:45, sistem akan otomatis memecah menjadi sesi saat booking.
        </div>
      </section>

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
        <form onSubmit={createBulkSlots} className="grid gap-3 md:grid-cols-3 md:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Simulator</span>
            <select className="h-10 rounded-lg border border-zinc-200 px-3" value={simulatorId} onChange={(e) => setSimulatorId(e.target.value)}>
              {simulators.map((s) => (
                <option key={s.id} value={s.id}>{s.category} {s.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Mode</span>
            <select className="h-10 rounded-lg border border-zinc-200 px-3" value={bulkRepeatUnit} onChange={(e) => setBulkRepeatUnit(e.target.value as any)}>
              <option value="WEEK">Senin-Jumat (1 minggu)</option>
              <option value="MONTH">Setiap hari kerja sebulan</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Sampai tanggal (WIB)</span>
            <input type="date" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" value={bulkUntilDate} onChange={(e) => setBulkUntilDate(e.target.value)} />
          </label>

          <button disabled={bulkLoading} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-3">
            {bulkLoading ? "Menyimpan..." : "Buat Slot Berulang"}
          </button>

          <div className="text-xs text-zinc-500 md:col-span-3">
            Slot dibuat otomatis untuk semua jam (07:30–15:45 WIB, per jam). Slot yang bentrok akan dilewati.
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="text-sm font-semibold">Daftar Slot</div>
        </div>

        {/* Calendar */}
        <div className="grid gap-6">
          <div className="grid gap-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth.month === 0) {
                    setCalendarMonth({ year: calendarMonth.year - 1, month: 11 });
                  } else {
                    setCalendarMonth({ ...calendarMonth, month: calendarMonth.month - 1 });
                  }
                }}
                className="h-10 w-10 rounded-lg border border-zinc-200 hover:bg-zinc-50"
              >
                ◀
              </button>
              <div className="text-lg font-semibold">
                {new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth.month === 11) {
                    setCalendarMonth({ year: calendarMonth.year + 1, month: 0 });
                  } else {
                    setCalendarMonth({ ...calendarMonth, month: calendarMonth.month + 1 });
                  }
                }}
                className="h-10 w-10 rounded-lg border border-zinc-200 hover:bg-zinc-50"
              >
                ▶
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid gap-2">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-zinc-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
                  // Adjust: Monday = 0 (1 % 7), so Sunday is 0. We need Monday = 0.
                  let dayOfWeek = firstDay.getDay(); // 0 = Sunday
                  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0

                  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
                  const cells = [];

                  // Empty cells before first day
                  for (let i = 0; i < dayOfWeek; i++) {
                    cells.push(null);
                  }

                  // Days of month
                  for (let day = 1; day <= daysInMonth; day++) {
                    cells.push(day);
                  }

                  return cells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="aspect-square" />;
                    }

                    const dateKey = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const daySlots = slotsByDate[dateKey] || [];
                    const available = daySlots.filter((s: Slot) => s.status === "AVAILABLE").length;
                    const booked = daySlots.filter((s: Slot) => s.status === "BOOKED").length;
                    const locked = daySlots.filter((s: Slot) => s.status === "LOCKED").length;
                    const isSelected = selectedDateKey === dateKey;

                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        onClick={() => setSelectedDateKey(isSelected ? null : dateKey)}
                        className={`aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center gap-1 transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : daySlots.length > 0
                              ? "border-zinc-200 hover:bg-zinc-50"
                              : "border-zinc-100 text-zinc-400"
                        }`}
                      >
                        <div className="text-sm font-medium">{day}</div>
                        {daySlots.length > 0 && (
                          <div className="flex gap-0.5">
                            {available > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${available} tersedia`} />}
                            {booked > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title={`${booked} terpesan`} />}
                            {locked > 0 && <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" title={`${locked} dikunci`} />}
                          </div>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Slot Details Panel */}
          {selectedDateKey && slotsByDate[selectedDateKey] && (
            <div className="border-t border-zinc-200 pt-6">
              <div className="text-sm font-semibold mb-4">Slot untuk {selectedDateKey}</div>
              <div className="grid gap-3">
                {slotsByDate[selectedDateKey].map((s: Slot) => {
                  const start = new Date(s.startAt);
                  const end = new Date(s.endAt);
                  const startTime = start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
                  const endTime = end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
                  const isEditing = editingId === s.id;

                  return (
                    <div key={s.id} className="border border-zinc-200 rounded-lg p-4">
                      {isEditing ? (
                        <div className="grid gap-3 md:grid-cols-3 md:items-end">
                          <label className="grid gap-1 text-sm">
                            <span className="font-medium">Start</span>
                            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} />
                          </label>
                          <label className="grid gap-1 text-sm">
                            <span className="font-medium">End</span>
                            <input type="datetime-local" className="h-10 rounded-lg border border-zinc-200 px-3" value={editEndAt} onChange={(e) => setEditEndAt(e.target.value)} />
                          </label>
                          <div className="flex items-center gap-2">
                            <button disabled={loading} onClick={() => saveEdit(s.id)} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">Simpan</button>
                            <button disabled={loading} onClick={() => setEditingId(null)} className="h-10 rounded-lg border border-zinc-200 px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">Batal</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <div className="font-medium">{startTime} - {endTime}</div>
                              <div className="text-xs text-zinc-600">{s.simulator.category} {s.simulator.name}</div>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                              s.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-700" :
                              s.status === "BOOKED" ? "bg-red-100 text-red-700" :
                              "bg-zinc-100 text-zinc-700"
                            }`}>
                              {s.status}
                            </div>
                          </div>
                          {s.booking && <div className="text-xs text-zinc-600 mb-3">Booking: {s.booking.user?.username ?? "-"}</div>}
                          <div className="flex flex-wrap items-center gap-2">
                            <button disabled={loading} onClick={() => startEdit(s)} className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">Edit</button>
                            {s.status === "BOOKED" && s.booking && (
                              <button disabled={loading} onClick={() => cancelBooking(s.id)} className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">Cancel Booking</button>
                            )}
                            {s.status !== "BOOKED" && !s.booking && (
                              confirmDeleteSlotId === s.id ? (
                                <>
                                  <div className="text-xs text-zinc-600">Yakin?</div>
                                  <button disabled={loading} onClick={() => setConfirmDeleteSlotId(null)} className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">Batal</button>
                                  <button disabled={loading} onClick={() => deleteSlot(s.id)} className="h-9 rounded-lg bg-red-600 px-3 text-sm text-white hover:bg-red-700 disabled:opacity-60">Delete</button>
                                </>
                              ) : (
                                <button disabled={loading} onClick={() => setConfirmDeleteSlotId(s.id)} className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">Delete</button>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
