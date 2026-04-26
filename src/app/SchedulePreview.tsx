"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WET_SESSIONS_WIB } from "@/lib/schedule";

type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  status: "AVAILABLE" | "LOCKED" | "BOOKED";
  leaseType: "WET" | "DRY";
  simulator: { category: string; name: string };
};

type Simulator = {
  id: string;
  category: "AIRBUS" | "BOEING";
  name: string;
};

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

function uniqSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatWibDateKey(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${dd}`;
}

function formatWibHm(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toWibMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return (Number(hh) || 0) * 60 + (Number(mm) || 0);
}

export default function SchedulePreview({ authed }: { authed: boolean | null }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [simulators, setSimulators] = useState<Simulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaseView, setLeaseView] = useState<"WET" | "DRY">("WET");

  const todayWibKey = useMemo(() => formatWibDateKey(new Date()), []);

  const [dateKey, setDateKey] = useState<string>(todayWibKey);

  const fromIso = useMemo(
    () => new Date(`${dateKey}T00:00:00+07:00`).toISOString(),
    [dateKey]
  );
  const toIso = useMemo(
    () => new Date(`${dateKey}T23:59:59+07:00`).toISOString(),
    [dateKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const slotRes = await fetch(
      `/api/public/slots?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      {
        cache: "no-store",
      }
    );

    const slotJson = (await slotRes
      .json()
      .catch(() => null)) as ApiRes<{ slots: Slot[] }> | null;

    if (!slotRes.ok || !slotJson || !slotJson.ok) {
      setError(slotJson && !slotJson.ok ? slotJson.error.message : "Gagal memuat jadwal");
      setLoading(false);
      return;
    }

    setSlots(slotJson.data.slots);
    setLoading(false);
  }, [fromIso, toIso]);

  const loadSimulators = useCallback(async () => {
    setSimLoading(true);

    const res = await fetch(`/api/public/simulators`, { cache: "no-store" });
    const json = (await res
      .json()
      .catch(() => null)) as ApiRes<{ simulators: Simulator[] }> | null;

    if (!res.ok || !json || !json.ok) {
      setSimLoading(false);
      return;
    }

    setSimulators(json.data.simulators);
    setSimLoading(false);
  }, []);

  useEffect(() => {
    loadSimulators();
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load, loadSimulators]);

  const daySlots = useMemo(() => {
    const openMin = 7 * 60 + 30;
    const closeMin = 15 * 60 + 45;

    return slots
      .filter((s) => {
        const startMin = toWibMinutes(s.startAt);
        const endMin = toWibMinutes(s.endAt);
        // Keep any slot intersecting operational hours.
        // (We may later decide if a slot fully covers a WET session.)
        return endMin > openMin && startMin < closeMin;
      })
      .slice()
      .sort((a, b) => {
        const t = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        if (t !== 0) return t;
        const sa = `${a.simulator.category} ${a.simulator.name}`;
        const sb = `${b.simulator.category} ${b.simulator.name}`;
        return sa.localeCompare(sb);
      });
  }, [slots]);

  const wetSlots = useMemo(() => daySlots.filter((s) => s.leaseType === "WET"), [daySlots]);
  const dryBlocks = useMemo(() => daySlots.filter((s) => s.leaseType === "DRY"), [daySlots]);

  const shown = useMemo(() => {
    if (leaseView === "WET") return wetSlots;
    // DRY view: tetap tampilkan slot jadwal (ScheduleSlot) sebagai basis availability,
    // lalu booking DRY akan menimpa status jadi BOOKED/LOCKED bila bentrok.
    return daySlots;
  }, [daySlots, dryBlocks, leaseView, wetSlots]);

  const timeBlocks = useMemo(() => {
    const blocks: { label: string; startMs: number; endMs: number }[] = [];
    const stepMin = 60;
    const ranges = [
      { startMin: 7 * 60 + 30, endMin: 11 * 60 + 30 },
      { startMin: 11 * 60 + 45, endMin: 15 * 60 + 45 },
    ];

    for (const r of ranges) {
      for (let startMin = r.startMin; startMin < r.endMin; startMin += stepMin) {
        const endMin = Math.min(startMin + stepMin, r.endMin);

        const startIso = new Date(`${dateKey}T${minutesToHm(startMin)}:00+07:00`).toISOString();
        const endIso = new Date(`${dateKey}T${minutesToHm(endMin)}:00+07:00`).toISOString();

        blocks.push({
          label: `${minutesToHm(startMin)}-${minutesToHm(endMin)}`,
          startMs: new Date(startIso).getTime(),
          endMs: new Date(endIso).getTime(),
        });
      }
    }

    return blocks;
  }, [dateKey]);

  const simulatorNamesByCategory = useMemo(() => {
    return {
      BOEING: uniqSorted(simulators.filter((s) => s.category === "BOEING").map((s) => s.name)),
      AIRBUS: uniqSorted(simulators.filter((s) => s.category === "AIRBUS").map((s) => s.name)),
    };
  }, [simulators]);

  const statusByCell = useMemo(() => {
    const priority: Record<Slot["status"], number> = {
      AVAILABLE: 1,
      LOCKED: 2,
      BOOKED: 3,
    };

    const m = new Map<string, Slot["status"]>();

    // Special rule for WET view:
    // - Render per sesi (2 blok)
    // - Jika ada DRY booking overlap, maka sesi WET yang tadinya AVAILABLE menjadi LOCKED
    //   (agar terlihat bentrok / tidak bisa dipakai barengan).
    if (leaseView === "WET") {
      const wetPresence = new Set<string>();

      for (const s of wetSlots) {
        const sStart = new Date(s.startAt).getTime();
        const sEnd = new Date(s.endAt).getTime();
        const cat = s.simulator.category;
        const simName = s.simulator.name;
        if (cat !== "BOEING" && cat !== "AIRBUS") continue;

        for (let i = 0; i < timeBlocks.length; i++) {
          const b = timeBlocks[i];
          // For WET session blocks, show availability only if a slot fully covers the session.
          // This avoids rendering a session as AVAILABLE when there is only a partial overlap.
          const covers = sStart <= b.startMs && sEnd >= b.endMs;
          if (!covers) continue;
          const key = `${cat}@@${simName}@@${i}`;
          wetPresence.add(key);
          const prev = m.get(key);
          if (!prev || priority[s.status] > priority[prev]) m.set(key, s.status);
        }
      }

      for (const d of dryBlocks) {
        const dStart = new Date(d.startAt).getTime();
        const dEnd = new Date(d.endAt).getTime();
        const cat = d.simulator.category;
        const simName = d.simulator.name;
        if (cat !== "BOEING" && cat !== "AIRBUS") continue;

        for (let i = 0; i < timeBlocks.length; i++) {
          const b = timeBlocks[i];
          const overlaps = dStart < b.endMs && dEnd > b.startMs;
          if (!overlaps) continue;

          const key = `${cat}@@${simName}@@${i}`;
          if (!wetPresence.has(key)) continue; // kalau sesi belum dibuka, tetap abu-abu

          const prev = m.get(key);
          if (prev === "AVAILABLE") m.set(key, "LOCKED");
        }
      }

      return m;
    }

    for (const s of shown) {
      const sStart = new Date(s.startAt).getTime();
      const sEnd = new Date(s.endAt).getTime();
      const cat = s.simulator.category;
      const simName = s.simulator.name;
      if (cat !== "BOEING" && cat !== "AIRBUS") continue;

      for (let i = 0; i < timeBlocks.length; i++) {
        const b = timeBlocks[i];
        const covers = sStart <= b.startMs && sEnd >= b.endMs;
        if (!covers) continue;

        const key = `${cat}@@${simName}@@${i}`;
        const prev = m.get(key);
        if (!prev || priority[s.status] > priority[prev]) m.set(key, s.status);
      }
    }

    return m;
  }, [dryBlocks, leaseView, shown, timeBlocks, wetSlots]);

  function TimeButton({ label, status }: { label: string; status: Slot["status"] | null }) {
    const cls =
      status === "AVAILABLE"
        ? "border-emerald-500/70 bg-white text-emerald-700 hover:bg-emerald-50"
        : status === "BOOKED" || status === "LOCKED"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-zinc-200 bg-white text-zinc-400";

    return (
      <div
        className={
          "flex h-11 w-full items-center justify-center rounded-none border text-sm font-medium transition " +
          cls
        }
        title={status ?? "BELUM_DIBUKA"}
      >
        {label}
      </div>
    );
  }

  return (
    <section className="border-t border-zinc-200 py-10 sm:py-12">
      <div className="mt-4 overflow-hidden rounded-none border border-zinc-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow">
        <div className="border-b border-white/10 bg-[#05164d] px-4 py-3 text-white">
          <h2 className="text-base font-bold tracking-tight">Jadwal Simulator</h2>
        </div>

        <div className="flex flex-wrap items-end gap-4 px-4 py-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Tanggal (WIB)</span>
            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="h-9 w-[220px] rounded-none border border-zinc-200 bg-white px-2 text-sm transition-colors duration-200 focus:border-zinc-400 focus:outline-none"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Tampilkan</span>
            <select
              value={leaseView}
              onChange={(e) => setLeaseView(e.target.value as any)}
              className="h-9 w-[220px] rounded-none border border-zinc-200 bg-white px-2 text-sm transition-colors duration-200 focus:border-zinc-400 focus:outline-none"
            >
              <option value="WET">Wet Leased</option>
              <option value="DRY">Dry Leased</option>
            </select>
          </label>

          <div className="pb-1 text-xs font-medium text-zinc-500">Jam operasional: 07:30–15:45</div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        {loading || simLoading ? (
          <div className="text-sm text-zinc-600">Loading...</div>
        ) : (
          <div className="grid gap-6">
            {([
              { key: "BOEING", label: "Boeing" },
              { key: "AIRBUS", label: "Airbus" },
            ] as const).map((cat) => {
              const simNames = simulatorNamesByCategory[cat.key];
              const hasSimulators = simNames.length > 0;

              return (
                <div key={cat.key} className="overflow-hidden rounded-none border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#05164d] px-4 py-3 text-white">
                    <div className="text-sm font-bold tracking-tight">{cat.label}</div>
                  </div>

                  {!hasSimulators ? (
                    <div className="px-4 py-4 text-sm text-zinc-600">
                      Belum ada simulator {cat.label}.
                    </div>
                  ) : (
                    <div className="px-4 py-4">
                      <div className="grid gap-4">
                        {simNames.map((simName) => (
                          <div key={simName} className="overflow-hidden rounded-none border border-zinc-200 bg-white">
                            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                              <div className="text-sm font-bold text-[#05164d]">{simName}</div>
                            </div>
                            <div className="p-4">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                              {timeBlocks.map((b, i) => {
                                const key = `${cat.key}@@${simName}@@${i}`;
                                const status = statusByCell.get(key) ?? null;
                                return <TimeButton key={key} label={b.label} status={status} />;
                              })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Hijau = AVAILABLE, merah = BOOKED/LOCKED, abu-abu = slot belum dibuka/belum ada jadwal.
      </div>
    </section>
  );
}
