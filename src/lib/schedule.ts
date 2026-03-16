export type WetSessionKey = "MORNING" | "AFTERNOON";

export const WET_SESSIONS_WIB: Record<WetSessionKey, { label: string; startMin: number; endMin: number }> = {
  MORNING: { label: "Sesi Pagi", startMin: 7 * 60 + 30, endMin: 11 * 60 + 30 },
  AFTERNOON: { label: "Sesi Siang", startMin: 11 * 60 + 45, endMin: 15 * 60 + 45 },
};

function getWibParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";

  return { hour: Number(hh) || 0, minute: Number(mm) || 0 };
}

export function toWibMinutes(d: Date) {
  const { hour, minute } = getWibParts(d);
  return hour * 60 + minute;
}

export function getWetSessionKeyForRange(startAt: Date, endAt: Date): WetSessionKey | null {
  const s = toWibMinutes(startAt);
  const e = toWibMinutes(endAt);

  if (s === WET_SESSIONS_WIB.MORNING.startMin && e === WET_SESSIONS_WIB.MORNING.endMin) return "MORNING";
  if (s === WET_SESSIONS_WIB.AFTERNOON.startMin && e === WET_SESSIONS_WIB.AFTERNOON.endMin) return "AFTERNOON";
  return null;
}
