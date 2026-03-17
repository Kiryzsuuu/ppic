"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WET_SESSIONS_WIB } from "@/lib/schedule";

type Simulator = { id: string; category: string; name: string };

type UserLite = {
  id: string;
  username: string;
  email?: string | null;
  profile?: { fullName: string } | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function StaffBookingForm(props: { users: UserLite[]; simulators: Simulator[] }) {
  const router = useRouter();

  const { users, simulators } = props;

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [leaseType, setLeaseType] = useState<"WET" | "DRY">("WET");
  const [userId, setUserId] = useState<string>("");
  const [simulatorId, setSimulatorId] = useState<string>("");
  const [dateKey, setDateKey] = useState<string>("");

  // WET
  const [wetSessionKey, setWetSessionKey] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [trainingCode, setTrainingCode] = useState<"PPC" | "TYPE_RATING" | "OTHER">("PPC");
  const [trainingName, setTrainingName] = useState<string>("Pilot Proficiency Training (PPC)");
  const [personCount, setPersonCount] = useState<1 | 2>(1);

  // DRY
  const [deviceType, setDeviceType] = useState<"FFS" | "FTD">("FFS");
  const [drySessionKey, setDrySessionKey] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [startMin, setStartMin] = useState<number>(7 * 60 + 30);
  const [endMin, setEndMin] = useState<number>(8 * 60 + 30);

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

  useEffect(() => {
    if (!dateKey) setDateKey(todayWibDateKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId && users.length > 0) setUserId(users[0].id);
  }, [userId, users]);

  useEffect(() => {
    if (!simulatorId && simulators.length > 0) setSimulatorId(simulators[0].id);
  }, [simulatorId, simulators]);

  useEffect(() => {
    const starts = dryStartOptions(drySessionKey);
    const ends = dryEndOptions(drySessionKey);
    if (!starts.includes(startMin)) setStartMin(starts[0]);
    if (!ends.includes(endMin) || endMin <= startMin) {
      const nextEnd = ends.find((e) => e > startMin) ?? ends[0];
      setEndMin(nextEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drySessionKey, startMin]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!userId) {
      setError("Pilih user terlebih dahulu.");
      return;
    }
    if (!simulatorId) {
      setError("Pilih simulator terlebih dahulu.");
      return;
    }
    if (!dateKey) {
      setError("Pilih tanggal terlebih dahulu.");
      return;
    }

    if (leaseType === "WET" && !trainingName.trim()) {
      setError("Training Name wajib diisi untuk WET.");
      return;
    }

    setLoading(true);

    const payload =
      leaseType === "WET"
        ? {
            leaseType: "WET" as const,
            userId,
            simulatorId,
            dateKey,
            sessionKey: wetSessionKey,
            trainingCode,
            trainingName: trainingName.trim(),
            personCount,
          }
        : {
            leaseType: "DRY" as const,
            userId,
            simulatorId,
            dateKey,
            deviceType,
            startMin,
            endMin,
          };

    const res = await fetch("/api/instructor/bookings/staff-book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => null)) as ApiRes<unknown> | null;

    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal booking");
      setLoading(false);
      return;
    }

    setResult("Booking berhasil dibuat (langsung CONFIRMED).");
    setLoading(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-4">
      <div className="text-sm font-semibold">Booking untuk User</div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{result}</div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-6 md:items-end">
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium">User</span>
          <select
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loading}
          >
            <option value="" disabled>
              Pilih user
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

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium">Simulator</span>
          <select
            className="h-10 rounded-lg border border-zinc-200 px-3"
            value={simulatorId}
            onChange={(e) => setSimulatorId(e.target.value)}
            disabled={loading}
          >
            {simulators.map((s) => (
              <option key={s.id} value={s.id}>
                {s.category} {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium">Leased Type</span>
          <select
            className="h-10 rounded-lg border border-zinc-200 px-3"
            value={leaseType}
            onChange={(e) => setLeaseType(e.target.value as "WET" | "DRY")}
            disabled={loading}
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
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            disabled={loading}
          />
        </label>

        {leaseType === "WET" ? (
          <>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Sesi</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={wetSessionKey}
                onChange={(e) => setWetSessionKey(e.target.value as "MORNING" | "AFTERNOON")}
                disabled={loading}
              >
                <option value="MORNING">Morning ({fmtMin(WET_SESSIONS_WIB.MORNING.startMin)}–{fmtMin(WET_SESSIONS_WIB.MORNING.endMin)})</option>
                <option value="AFTERNOON">Afternoon ({fmtMin(WET_SESSIONS_WIB.AFTERNOON.startMin)}–{fmtMin(WET_SESSIONS_WIB.AFTERNOON.endMin)})</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Person</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={personCount}
                onChange={(e) => setPersonCount((Number(e.target.value) as 1 | 2) ?? 1)}
                disabled={loading}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Training</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={trainingCode}
                onChange={(e) => {
                  const v = e.target.value as "PPC" | "TYPE_RATING" | "OTHER";
                  setTrainingCode(v);
                  setTrainingName(
                    v === "PPC" ? "Pilot Proficiency Training (PPC)" : v === "TYPE_RATING" ? "Initial Type Rating" : trainingName,
                  );
                }}
                disabled={loading}
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
                value={trainingName}
                onChange={(e) => setTrainingName(e.target.value)}
                disabled={loading}
              />
            </label>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Sesi DRY</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={drySessionKey}
                onChange={(e) => setDrySessionKey(e.target.value as "MORNING" | "AFTERNOON")}
                disabled={loading}
              >
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Device</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as "FFS" | "FTD")}
                disabled={loading}
              >
                <option value="FFS">FFS</option>
                <option value="FTD">FTD</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Mulai</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={String(startMin)}
                onChange={(e) => setStartMin(Number(e.target.value))}
                disabled={loading}
              >
                {dryStartOptions(drySessionKey).map((m) => (
                  <option key={m} value={String(m)}>
                    {fmtMin(m)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Selesai</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                value={String(endMin)}
                onChange={(e) => setEndMin(Number(e.target.value))}
                disabled={loading}
              >
                {dryEndOptions(drySessionKey)
                  .filter((m) => m > startMin)
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
          disabled={loading}
          className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-2"
        >
          {loading ? "Memproses..." : "Booking"}
        </button>
      </form>

      <div className="text-xs text-zinc-500">
        Catatan: booking staff akan langsung membuat booking status CONFIRMED. Untuk WET, slot sesi harus sudah dibuat (AVAILABLE) oleh admin.
      </div>
    </section>
  );
}
