"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  status: "AVAILABLE" | "LOCKED" | "BOOKED";
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

  const shown = useMemo(() => {
    const openMin = 7 * 60 + 30;
    const closeMin = 15 * 60 + 45;

    return slots
      .filter((s) => {
        const startMin = toWibMinutes(s.startAt);
        const endMin = toWibMinutes(s.endAt);
        return startMin >= openMin && endMin <= closeMin;
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

  const timeBlocks = useMemo(() => {
    const openMin = 7 * 60 + 30;
    const closeMin = 15 * 60 + 45;
    const stepMin = 60;

    const blocks: {
      label: string;
      startMs: number;
      endMs: number;
    }[] = [];

    for (let startMin = openMin; startMin < closeMin; startMin += stepMin) {
      const endMin = Math.min(startMin + stepMin, closeMin);

      const startIso = new Date(
        `${dateKey}T${minutesToHm(startMin)}:00+07:00`
      ).toISOString();
      const endIso = new Date(
        `${dateKey}T${minutesToHm(endMin)}:00+07:00`
      ).toISOString();

      blocks.push({
        label: `${minutesToHm(startMin)}-${minutesToHm(endMin)}`,
        startMs: new Date(startIso).getTime(),
        endMs: new Date(endIso).getTime(),
      });
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
    for (const s of shown) {
      const sStart = new Date(s.startAt).getTime();
      const sEnd = new Date(s.endAt).getTime();
      const cat = s.simulator.category;
      const simName = s.simulator.name;
      if (cat !== "BOEING" && cat !== "AIRBUS") continue;

      for (let i = 0; i < timeBlocks.length; i++) {
        const b = timeBlocks[i];
        const overlaps = sStart < b.endMs && sEnd > b.startMs;
        if (!overlaps) continue;

        const key = `${cat}@@${simName}@@${i}`;
        const prev = m.get(key);
        if (!prev || priority[s.status] > priority[prev]) m.set(key, s.status);
      }
    }
    return m;
  }, [shown, timeBlocks]);

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
          "flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium transition " +
          cls
        }
        title={status ?? "BELUM_DIBUKA"}
      >
        {label}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Jadwal Simulator</h2>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] text-zinc-600">Tanggal (WIB)</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="h-9 w-[220px] rounded-lg border border-zinc-200 bg-white px-2 text-sm"
          />
        </label>
        <div className="pb-1 text-xs text-zinc-500">Jam operasional: 07:30–15:45</div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
                <div key={cat.key} className="rounded-xl border border-zinc-200 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
                    <div className="text-sm font-semibold text-zinc-800">{cat.label}</div>
                  </div>

                  {!hasSimulators ? (
                    <div className="px-4 py-4 text-sm text-zinc-600">
                      Belum ada simulator {cat.label}.
                    </div>
                  ) : (
                    <div className="px-4 py-4">
                      <div className="grid gap-4">
                        {simNames.map((simName) => (
                          <div key={simName} className="rounded-xl border border-zinc-200 bg-white p-4">
                            <div className="text-sm font-semibold text-zinc-800">{simName}</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                              {timeBlocks.map((b, i) => {
                                const key = `${cat.key}@@${simName}@@${i}`;
                                const status = statusByCell.get(key) ?? null;
                                return <TimeButton key={key} label={b.label} status={status} />;
                              })}
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
