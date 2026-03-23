import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";
import PrintButton from "@/app/PrintButton";
import PrintTitle from "@/app/PrintTitle";
import type { Prisma } from "@prisma/client";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_START_SHIFT_MS = WIB_OFFSET_MS - 60 * 1000; // WIB boundary at 00:01

const REPORT_CONTACT = {
  address: "Jl. Raya PLP Curug, Kec. Legok, Kabupaten Tangerang, Banten 15820",
  email: "dpu@ppicurug.ac.id",
  phone: "+62 877-7822-9661",
} as const;

const DEFAULT_RANGE_DAYS = 30; // ~1 bulan
const PRINT_TAKE = 5000;

const ACTION_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium leading-none text-zinc-900 hover:bg-zinc-50";

function dayKeyWIB(dt: Date) {
  return new Date(dt.getTime() + DAY_START_SHIFT_MS).toISOString().slice(0, 10);
}

function dayStartFromKeyWIB(key: string) {
  return new Date(`${key}T00:01:00+07:00`);
}

function lastNDaysWIB(n: number) {
  const days: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const now = new Date();
  const todayKey = dayKeyWIB(now);
  const todayStart = dayStartFromKeyWIB(todayKey);
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(todayStart);
    start.setUTCDate(start.getUTCDate() - i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const key = dayKeyWIB(start);
    days.push({ key, label: key.slice(5), start, end });
  }
  return days;
}

function isDayKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDaysUTC(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function groupDaysIntoWeeks(days: Array<{ key: string; label: string; start: Date; end: Date }>) {
  const buckets: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
    dayKeys: string[];
  }> = [];

  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    if (slice.length === 0) break;
    const startKey = slice[0].key;
    const endKey = slice[slice.length - 1].key;
    buckets.push({
      key: startKey,
      label: `${startKey.slice(5)}–${endKey.slice(5)}`,
      start: slice[0].start,
      end: slice[slice.length - 1].end,
      dayKeys: slice.map((d) => d.key),
    });
  }
  return buckets;
}

function rangeDaysWIB(fromKey: string, toKey: string, maxDays = 62) {
  const from = dayStartFromKeyWIB(fromKey);
  const to = dayStartFromKeyWIB(toKey);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  if (from.getTime() > to.getTime()) return null;

  const days: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const cursor = new Date(from);
  let guard = 0;
  while (cursor.getTime() <= to.getTime()) {
    if (guard++ > maxDays) break;
    const start = new Date(cursor);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const key = dayKeyWIB(start);
    days.push({ key, label: key.slice(5), start, end });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function countByDay(rows: Array<{ createdAt: Date }>, keys: string[]) {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, 0);
  for (const r of rows) {
    const k = dayKeyWIB(r.createdAt);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return keys.map((k) => map.get(k) ?? 0);
}

function MiniLineChart(props: {
  title: string;
  days: Array<{ key: string; label: string }>;
  dayKeys: string[];
  series: number[];
  max: number;
  colorClassName: string;
  hrefForDayKey?: (dayKey: string) => string;
  selectedDayKey?: string | null;
  rangeStartKey: string;
  rangeEndKey: string;
  rangeDaysCount: number;
}) {
  const { title, days, dayKeys, series, max, colorClassName, hrefForDayKey, selectedDayKey, rangeStartKey, rangeEndKey, rangeDaysCount } = props;
  const n = series.length;

  const W = 640;
  const H = 190;
  const PAD_X = 44;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 86;
  const innerW = Math.max(1, W - PAD_X * 2);
  const innerH = Math.max(1, H - PAD_TOP - PAD_BOTTOM);

  const safeMax = Math.max(1, max);
  const xAt = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_TOP + (1 - Math.min(1, Math.max(0, v / safeMax))) * innerH;

  const points = series.map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`).join(" ");

  const showAllDayTicks = n <= 31 && rangeDaysCount === n && dayKeys.every((k) => isDayKey(k));
  const tickCount = Math.min(6, Math.max(2, n));
  const tickIdx = showAllDayTicks
    ? Array.from({ length: n }, (_, i) => i).filter((i) => {
        const key = dayKeys[i] ?? "";
        const prev = i > 0 ? (dayKeys[i - 1] ?? "") : "";
        const isMonthBoundary = i === 0 || key.slice(0, 7) !== prev.slice(0, 7);
        const step = n <= 20 ? 1 : 2; // 1 bulan: tampil tiap 2 hari agar tidak tabrakan
        return isMonthBoundary || i === n - 1 || i % step === 0;
      })
    : Array.from({ length: tickCount }, (_, t) => Math.round((t / (tickCount - 1)) * (n - 1)));
  const tickSet = new Set(tickIdx);

  const yTicksAsc = (() => {
    if (safeMax <= 12) return Array.from({ length: safeMax + 1 }, (_, i) => i);
    const targetTicks = 6;
    const step = Math.max(1, Math.ceil(safeMax / (targetTicks - 1)));
    const ticks: number[] = [];
    for (let v = 0; v < safeMax; v += step) ticks.push(v);
    ticks.push(safeMax);
    return ticks;
  })();
  const yTicks = [...yTicksAsc].reverse();

  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 print-avoid-break" data-chart="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorClassName.replace("text-", "bg-")}`} aria-hidden="true" />
          <div className="min-w-0 text-sm font-semibold truncate">{title}</div>
        </div>
        <div className="text-xs text-zinc-600">Max: {safeMax.toLocaleString("id-ID")}</div>
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} preserveAspectRatio="none">
          {yTicks.map((v) => {
            const y = yAt(v);
            return (
              <g key={`y-${v}`}>
                <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgb(244 244 245)" strokeWidth="1" />
                <text x={PAD_X - 8} y={y + 3} textAnchor="end" fontSize="10" fill="rgb(82 82 91)">
                  {v.toLocaleString("id-ID")}
                </text>
              </g>
            );
          })}

          <line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke="rgb(228 228 231)" strokeWidth="1" />
          <line x1={PAD_X} y1={PAD_TOP} x2={PAD_X} y2={H - PAD_BOTTOM} stroke="rgb(228 228 231)" strokeWidth="1" />

          <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} className={colorClassName} />

          {series.map((v, i) => {
            const key = dayKeys[i];
            const href = hrefForDayKey ? hrefForDayKey(key) : "#";
            const cx = xAt(i);
            const cy = yAt(v);
            const active = selectedDayKey === key;
            const r = active ? 4.2 : 3.2;

            return (
              <a key={key} href={href}>
                <circle cx={cx} cy={cy} r={r} fill="white" stroke="currentColor" strokeWidth={2} className={colorClassName} />
              </a>
            );
          })}

          {series.map((_, i) => {
            if (!tickSet.has(i)) return null;
            const cx = xAt(i);
            const fullKey = dayKeys[i] ?? "";
            const dayOnly = fullKey.slice(8, 10);
            const monthDay = fullKey.slice(5, 10);
            const prevKey = i > 0 ? (dayKeys[i - 1] ?? "") : "";
            const isMonthBoundary = i === 0 || fullKey.slice(0, 7) !== prevKey.slice(0, 7);

            const label = showAllDayTicks ? (isMonthBoundary ? monthDay : dayOnly) : (days[i]?.label ?? "");
            const isFirst = i === 0;
            const isLast = i === n - 1;
            const dx = isFirst ? 12 : isLast ? -12 : 0;
            return showAllDayTicks ? (
              <text
                key={`t-${dayKeys[i]}`}
                transform={`translate(${(cx + dx).toFixed(2)}, ${H - 14}) rotate(-60)`}
                textAnchor={isFirst ? "start" : "end"}
                fontSize="8"
                fill="rgb(82 82 91)"
              >
                {label}
              </text>
            ) : (
              <text
                key={`t-${dayKeys[i]}`}
                x={cx}
                y={H - 12}
                textAnchor="middle"
                fontSize="10"
                fill="rgb(82 82 91)"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 text-xs text-zinc-600">
        Range: {rangeStartKey} – {rangeEndKey} ({rangeDaysCount} hari)
      </div>
    </section>
  );
}

function sum(nums: number[]) {
  return nums.reduce((acc, v) => acc + v, 0);
}

function peakDay(series: number[], dayKeys: string[]) {
  let bestKey = dayKeys[0] ?? "-";
  let bestVal = 0;
  for (let i = 0; i < series.length; i++) {
    const v = series[i] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      bestKey = dayKeys[i] ?? bestKey;
    }
  }
  return { key: bestKey, value: bestVal };
}

export default async function FinanceDashboardReport({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "FINANCE") redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const fromParam = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const toParam = Array.isArray(sp.to) ? sp.to[0] : sp.to;
  const dayParam = Array.isArray(sp.day) ? sp.day[0] : sp.day;
  const weekParam = Array.isArray(sp.week) ? sp.week[0] : sp.week;
  const printParam = Array.isArray(sp.print) ? sp.print[0] : sp.print;
  const printMode = printParam === "1";

  const defaultDays = lastNDaysWIB(DEFAULT_RANGE_DAYS);
  const fallbackFrom = defaultDays[0]?.key;
  const fallbackTo = defaultDays[defaultDays.length - 1]?.key;

  const fromKey = fromParam && isDayKey(fromParam) ? fromParam : fallbackFrom;
  const toKey = toParam && isDayKey(toParam) ? toParam : fallbackTo;

  const days = fromKey && toKey ? rangeDaysWIB(fromKey, toKey) ?? defaultDays : defaultDays;
  const dayKeys = days.map((d) => d.key);
  const rangeStart = days[0].start;
  const rangeEnd = days[days.length - 1].end;

  const exportHref = `/api/finance/reports/export?from=${encodeURIComponent(dayKeys[0])}&to=${encodeURIComponent(
    dayKeys[dayKeys.length - 1]
  )}`;

  const useWeeklyChart = dayKeys.length > 10;
  const weekBuckets = useWeeklyChart ? groupDaysIntoWeeks(days) : null;
  const weekKeysSet = new Set(weekBuckets?.map((w) => w.key) ?? []);

  const drillBase = new URLSearchParams({ from: dayKeys[0], to: dayKeys[dayKeys.length - 1] });
  const selectedWeekKey = weekParam && isDayKey(weekParam) && useWeeklyChart && weekKeysSet.has(weekParam) ? weekParam : null;
  const selectedDayKey = !selectedWeekKey && dayParam && isDayKey(dayParam) && dayKeys.includes(dayParam) ? dayParam : null;
  const hrefForDayKey = (k: string) => {
    const q = new URLSearchParams(drillBase);
    q.set("day", k);
    return `/finance/dashboard/report?${q.toString()}#detail`;
  };

  const hrefForWeekKey = (k: string) => {
    const q = new URLSearchParams(drillBase);
    q.set("week", k);
    return `/finance/dashboard/report?${q.toString()}#detail`;
  };

  const hrefForChartKey = useWeeklyChart ? hrefForWeekKey : hrefForDayKey;
  const selectedChartKey = selectedWeekKey ?? selectedDayKey;

  const selectedWeekBucket = selectedWeekKey && weekBuckets ? weekBuckets.find((w) => w.key === selectedWeekKey) ?? null : null;

  const selectedStart = selectedWeekKey ? dayStartFromKeyWIB(selectedWeekKey) : selectedDayKey ? dayStartFromKeyWIB(selectedDayKey) : null;

  let selectedEndExclusive = selectedStart ? (selectedWeekKey ? addDaysUTC(selectedStart, 7) : addDaysUTC(selectedStart, 1)) : null;
  if (selectedEndExclusive && selectedEndExclusive.getTime() > rangeEnd.getTime()) {
    selectedEndExclusive = rangeEnd;
  }

  const idxByDayKey = new Map(dayKeys.map((k, i) => [k, i] as const));
  const sumSeriesForKeys = (series: number[], keys: string[]) => keys.reduce((acc, k) => acc + (series[idxByDayKey.get(k) ?? -1] ?? 0), 0);

  const chartDays: Array<{ key: string; label: string }> = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => ({ key: w.key, label: w.label })) : days;
  const chartKeys: string[] = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => w.key) : dayKeys;

  const [logsDetail, legalDetail] = selectedStart && selectedEndExclusive
    ? await Promise.all([
        prisma.auditLog.findMany({
          where: {
            action: { in: ["booking.submitted", "payment.submitted", "payment.validated"] },
            createdAt: { gte: selectedStart, lt: selectedEndExclusive },
          },
          include: { actor: { select: { username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.legalDocument.findMany({
          where: { issuedAt: { gte: selectedStart, lt: selectedEndExclusive } },
          select: { id: true, bookingId: true, type: true, status: true, issuedAt: true },
          orderBy: { issuedAt: "desc" },
          take: 50,
        }),
      ])
    : [[], []];

  type BookingWithRefs = Prisma.BookingGetPayload<{
    include: {
      user: { select: { username: true; email: true } };
      simulator: true;
    };
  }>;

  type PaymentWithRefs = Prisma.PaymentGetPayload<{
    include: {
      validatedBy: { select: { username: true } };
      booking: {
        include: {
          user: { select: { username: true; email: true } };
          simulator: true;
        };
      };
    };
  }>;

  const logsPrint = printMode
    ? await prisma.auditLog.findMany({
        where: {
          action: { in: ["booking.submitted", "payment.submitted", "payment.validated"] },
          createdAt: { gte: rangeStart, lt: rangeEnd },
        },
        include: { actor: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
        take: PRINT_TAKE,
      })
    : [];

  const legalPrint = printMode
    ? await prisma.legalDocument.findMany({
        where: { issuedAt: { gte: rangeStart, lt: rangeEnd } },
        select: { id: true, bookingId: true, type: true, status: true, issuedAt: true },
        orderBy: { issuedAt: "asc" },
        take: PRINT_TAKE,
      })
    : [];

  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  const bookingIds = uniq(logsDetail.filter((l) => l.action === "booking.submitted").map((l) => l.targetId).filter(isString));
  const paymentSubmittedIds = uniq(logsDetail.filter((l) => l.action === "payment.submitted").map((l) => l.targetId).filter(isString));
  const paymentValidatedIds = uniq(logsDetail.filter((l) => l.action === "payment.validated").map((l) => l.targetId).filter(isString));
  const paymentIds = uniq([...paymentSubmittedIds, ...paymentValidatedIds]);

  const bookingSubmittedAtById = new Map<string, Date>();
  const paymentSubmittedAtById = new Map<string, Date>();
  const paymentValidatedAtById = new Map<string, Date>();
  for (const l of logsDetail) {
    if (!l.targetId) continue;
    if (l.action === "booking.submitted") bookingSubmittedAtById.set(l.targetId, l.createdAt);
    if (l.action === "payment.submitted") paymentSubmittedAtById.set(l.targetId, l.createdAt);
    if (l.action === "payment.validated") paymentValidatedAtById.set(l.targetId, l.createdAt);
  }

  const bookingSubmittedAtPrintById = new Map<string, Date>();
  const paymentSubmittedAtPrintById = new Map<string, Date>();
  const paymentValidatedAtPrintById = new Map<string, Date>();
  for (const l of logsPrint) {
    if (!l.targetId) continue;
    if (l.action === "booking.submitted") bookingSubmittedAtPrintById.set(l.targetId, l.createdAt);
    if (l.action === "payment.submitted") paymentSubmittedAtPrintById.set(l.targetId, l.createdAt);
    if (l.action === "payment.validated") paymentValidatedAtPrintById.set(l.targetId, l.createdAt);
  }

  const bookingSubmittedPrintIds = uniq(logsPrint.filter((l) => l.action === "booking.submitted").map((l) => l.targetId).filter(isString));
  const paymentSubmittedPrintIds = uniq(logsPrint.filter((l) => l.action === "payment.submitted").map((l) => l.targetId).filter(isString));
  const paymentValidatedPrintIds = uniq(logsPrint.filter((l) => l.action === "payment.validated").map((l) => l.targetId).filter(isString));
  const paymentPrintIds = uniq([...paymentSubmittedPrintIds, ...paymentValidatedPrintIds]);

  const [bookingsPrint, paymentsPrint] = printMode && (bookingSubmittedPrintIds.length > 0 || paymentPrintIds.length > 0)
    ? await Promise.all([
        bookingSubmittedPrintIds.length
          ? prisma.booking.findMany({
              where: { id: { in: bookingSubmittedPrintIds } },
              include: { user: { select: { username: true, email: true } }, simulator: true },
            })
          : Promise.resolve([] as BookingWithRefs[]),
        paymentPrintIds.length
          ? prisma.payment.findMany({
              where: { id: { in: paymentPrintIds } },
              include: {
                validatedBy: { select: { username: true } },
                booking: { include: { user: { select: { username: true, email: true } }, simulator: true } },
              },
            })
          : Promise.resolve([] as PaymentWithRefs[]),
      ])
    : ([[] as BookingWithRefs[], [] as PaymentWithRefs[]] as const);

  const bookingPrintById = new Map(bookingsPrint.map((b) => [b.id, b] as const));
  const paymentPrintById = new Map(paymentsPrint.map((p) => [p.id, p] as const));

  const bookingSubmittedPrintRows = bookingSubmittedPrintIds
    .map((id) => {
      const b = bookingPrintById.get(id);
      if (!b) return null;
      return { id, booking: b, at: bookingSubmittedAtPrintById.get(id) ?? b.requestedStartAt ?? b.requestedEndAt ?? new Date(0) };
    })
    .filter(Boolean) as Array<{ id: string; booking: BookingWithRefs; at: Date }>;

  const paymentSubmittedPrintRows = paymentSubmittedPrintIds
    .map((id) => {
      const p = paymentPrintById.get(id);
      if (!p) return null;
      return { id, payment: p, at: paymentSubmittedAtPrintById.get(id) ?? p.paidAt ?? p.createdAt };
    })
    .filter(Boolean) as Array<{ id: string; payment: PaymentWithRefs; at: Date }>;

  const paymentValidatedPrintRows = paymentValidatedPrintIds
    .map((id) => {
      const p = paymentPrintById.get(id);
      if (!p) return null;
      return { id, payment: p, at: paymentValidatedAtPrintById.get(id) ?? p.validatedAt ?? p.createdAt };
    })
    .filter(Boolean) as Array<{ id: string; payment: PaymentWithRefs; at: Date }>;

  const [bookingsDetail, paymentsDetail] = bookingIds.length > 0 || paymentIds.length > 0
    ? await Promise.all([
        bookingIds.length
          ? prisma.booking.findMany({
              where: { id: { in: bookingIds } },
              include: { user: { select: { username: true, email: true } }, simulator: true },
            })
          : Promise.resolve([] as BookingWithRefs[]),
        paymentIds.length
          ? prisma.payment.findMany({
              where: { id: { in: paymentIds } },
              include: {
                validatedBy: { select: { username: true } },
                booking: { include: { user: { select: { username: true, email: true } }, simulator: true } },
              },
            })
          : Promise.resolve([] as PaymentWithRefs[]),
      ])
    : ([[] as BookingWithRefs[], [] as PaymentWithRefs[]] as const);

  const bookingById = new Map(bookingsDetail.map((b) => [b.id, b] as const));
  const paymentById = new Map(paymentsDetail.map((p) => [p.id, p] as const));

  const bookingSubmittedRows = bookingIds
    .map((id) => {
      const b = bookingById.get(id);
      if (!b) return null;
      return {
        id,
        booking: b,
        at: bookingSubmittedAtById.get(id) ?? b.requestedStartAt ?? b.requestedEndAt ?? new Date(0),
      };
    })
    .filter(Boolean) as Array<{ id: string; booking: BookingWithRefs; at: Date }>;

  const paymentSubmittedRows = paymentSubmittedIds
    .map((id) => {
      const p = paymentById.get(id);
      if (!p) return null;
      return { id, payment: p, at: paymentSubmittedAtById.get(id) ?? p.paidAt ?? p.createdAt };
    })
    .filter(Boolean) as Array<{ id: string; payment: PaymentWithRefs; at: Date }>;

  const paymentValidatedRows = paymentValidatedIds
    .map((id) => {
      const p = paymentById.get(id);
      if (!p) return null;
      return { id, payment: p, at: paymentValidatedAtById.get(id) ?? p.validatedAt ?? p.createdAt };
    })
    .filter(Boolean) as Array<{ id: string; payment: PaymentWithRefs; at: Date }>;

  const [bookingSubmitted, paymentSubmitted, paymentValidated, legalIssued] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "booking.submitted", createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "payment.submitted", createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "payment.validated", createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
    prisma.legalDocument.findMany({
      where: { issuedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { issuedAt: true },
    }),
  ]);

  const bookingSeries = countByDay(bookingSubmitted, dayKeys);
  const paymentSeries = countByDay(paymentSubmitted, dayKeys);
  const validatedSeries = countByDay(paymentValidated, dayKeys);
  const legalSeries = countByDay(legalIssued.map((d) => ({ createdAt: d.issuedAt })), dayKeys);

  const chartBookingSeries = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => sumSeriesForKeys(bookingSeries, w.dayKeys)) : bookingSeries;
  const chartPaymentSeries = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => sumSeriesForKeys(paymentSeries, w.dayKeys)) : paymentSeries;
  const chartValidatedSeries = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => sumSeriesForKeys(validatedSeries, w.dayKeys)) : validatedSeries;
  const chartLegalSeries = useWeeklyChart && weekBuckets ? weekBuckets.map((w) => sumSeriesForKeys(legalSeries, w.dayKeys)) : legalSeries;

  const maxBookings = Math.max(1, ...chartBookingSeries);
  const maxPayments = Math.max(1, ...chartPaymentSeries);
  const maxValidated = Math.max(1, ...chartValidatedSeries);
  const maxLegal = Math.max(1, ...chartLegalSeries);

  const totalBookings = sum(bookingSeries);
  const totalPayments = sum(paymentSeries);
  const totalValidated = sum(validatedSeries);
  const totalLegal = sum(legalSeries);
  const daysCount = dayKeys.length;

  const peakBookings = peakDay(bookingSeries, dayKeys);
  const peakPayments = peakDay(paymentSeries, dayKeys);
  const peakValidated = peakDay(validatedSeries, dayKeys);
  const peakLegal = peakDay(legalSeries, dayKeys);

  const avgBookings = daysCount > 0 ? Math.round(totalBookings / daysCount) : 0;
  const avgPayments = daysCount > 0 ? Math.round(totalPayments / daysCount) : 0;
  const avgValidated = daysCount > 0 ? Math.round(totalValidated / daysCount) : 0;
  const avgLegal = daysCount > 0 ? Math.round(totalLegal / daysCount) : 0;

  const selectedWeekBreakdown =
    selectedWeekBucket?.dayKeys.map((k) => {
      const i = idxByDayKey.get(k) ?? -1;
      return {
        key: k,
        bookings: bookingSeries[i] ?? 0,
        payments: paymentSeries[i] ?? 0,
        validated: validatedSeries[i] ?? 0,
        legal: legalSeries[i] ?? 0,
      };
    }) ?? null;

  return (
    <div className="grid w-full min-w-0 max-w-full gap-6" data-report-page="true">
      {printMode ? <PrintTitle title="" /> : null}
      <div className="print-only print-avoid-break">
        <div className="border-b border-zinc-200 pb-3">
          <div className="flex items-start gap-3">
            <img
              src="/logoppic/logoppic.7a5aa04c.png"
              alt="PPI Curug Simulator Training"
              width={56}
              height={40}
              className="h-10 w-auto"
            />
            <div className="min-w-0">
              <div className="text-base font-semibold">Laporan Aktivitas (Finance)</div>
              <div className="mt-0.5 text-xs text-zinc-600">
                Range: {dayKeys[0]} – {dayKeys[dayKeys.length - 1]} ({dayKeys.length} hari) • WIB
              </div>
              <div className="mt-2 text-xs leading-snug text-zinc-600">
                <div>Alamat: {REPORT_CONTACT.address}</div>
                <div>
                  Email: {REPORT_CONTACT.email} • Phone: {REPORT_CONTACT.phone}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3" data-print-hidden="true">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Laporan Aktivitas</h1>
          <div className="mt-1 text-sm text-zinc-600">Finance • Range: {dayKeys[0]} – {dayKeys[dayKeys.length - 1]} ({dayKeys.length} hari) • WIB</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className={ACTION_BUTTON_CLASS} href="/finance/dashboard">
            Kembali
          </a>
          <a className={ACTION_BUTTON_CLASS} href={exportHref}>
            Export Excel
          </a>
          <PrintButton className={ACTION_BUTTON_CLASS} />
        </div>
      </div>

      <section className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6" data-print-hidden="true">
        <div className="text-sm font-semibold">Pilih Range (WIB)</div>
        <form className="mt-3" method="GET" action="/finance/dashboard/report">
          <div className="grid grid-cols-1 gap-3 sm:flex sm:items-end sm:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:flex sm:items-end sm:gap-2">
              <label className="grid gap-1">
                <span className="text-[11px] text-zinc-600">Dari</span>
                <input name="from" type="date" defaultValue={days[0]?.key} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm" />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-zinc-600">Sampai</span>
                <input name="to" type="date" defaultValue={days[days.length - 1]?.key} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm" />
              </label>
            </div>
            <button type="submit" className="h-9 w-full rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto">
              Terapkan
            </button>
          </div>
        </form>
      </section>

      <MiniLineChart
        title="Booking Disubmit"
        days={chartDays}
        dayKeys={chartKeys}
        series={chartBookingSeries}
        max={maxBookings}
        colorClassName="text-emerald-600"
        hrefForDayKey={hrefForChartKey}
        selectedDayKey={selectedChartKey}
        rangeStartKey={dayKeys[0]}
        rangeEndKey={dayKeys[dayKeys.length - 1]}
        rangeDaysCount={dayKeys.length}
      />
      <MiniLineChart
        title="Bukti Pembayaran Disubmit"
        days={chartDays}
        dayKeys={chartKeys}
        series={chartPaymentSeries}
        max={maxPayments}
        colorClassName="text-amber-500"
        hrefForDayKey={hrefForChartKey}
        selectedDayKey={selectedChartKey}
        rangeStartKey={dayKeys[0]}
        rangeEndKey={dayKeys[dayKeys.length - 1]}
        rangeDaysCount={dayKeys.length}
      />
      <MiniLineChart
        title="Pembayaran Tervalidasi"
        days={chartDays}
        dayKeys={chartKeys}
        series={chartValidatedSeries}
        max={maxValidated}
        colorClassName="text-violet-600"
        hrefForDayKey={hrefForChartKey}
        selectedDayKey={selectedChartKey}
        rangeStartKey={dayKeys[0]}
        rangeEndKey={dayKeys[dayKeys.length - 1]}
        rangeDaysCount={dayKeys.length}
      />
      <MiniLineChart
        title="Dokumen Legal Diterbitkan"
        days={chartDays}
        dayKeys={chartKeys}
        series={chartLegalSeries}
        max={maxLegal}
        colorClassName="text-blue-600"
        hrefForDayKey={hrefForChartKey}
        selectedDayKey={selectedChartKey}
        rangeStartKey={dayKeys[0]}
        rangeEndKey={dayKeys[dayKeys.length - 1]}
        rangeDaysCount={dayKeys.length}
      />

      <section className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 print-avoid-break">
        <div className="text-sm font-semibold">Ringkasan</div>
        <div className="mt-3 rounded-xl border border-zinc-200" data-print-overflow="visible">
          <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Rata-rata / hari</th>
                <th className="px-3 py-2 text-left">Puncak</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-200">
                <td className="px-3 py-2 font-medium">Booking Disubmit</td>
                <td className="px-3 py-2 text-zinc-700">{totalBookings.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700">{avgBookings.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700" style={{ whiteSpace: "normal" }}>
                  {peakBookings.value.toLocaleString("id-ID")} ({peakBookings.key})
                </td>
              </tr>
              <tr className="border-t border-zinc-200">
                <td className="px-3 py-2 font-medium">Pembayaran Disubmit</td>
                <td className="px-3 py-2 text-zinc-700">{totalPayments.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700">{avgPayments.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700" style={{ whiteSpace: "normal" }}>
                  {peakPayments.value.toLocaleString("id-ID")} ({peakPayments.key})
                </td>
              </tr>
              <tr className="border-t border-zinc-200">
                <td className="px-3 py-2 font-medium">Pembayaran Tervalidasi</td>
                <td className="px-3 py-2 text-zinc-700">{totalValidated.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700">{avgValidated.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700" style={{ whiteSpace: "normal" }}>
                  {peakValidated.value.toLocaleString("id-ID")} ({peakValidated.key})
                </td>
              </tr>
              <tr className="border-t border-zinc-200">
                <td className="px-3 py-2 font-medium">Dokumen Legal</td>
                <td className="px-3 py-2 text-zinc-700">{totalLegal.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700">{avgLegal.toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-zinc-700" style={{ whiteSpace: "normal" }}>
                  {peakLegal.value.toLocaleString("id-ID")} ({peakLegal.key})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-zinc-600">Catatan: agregasi harian memakai WIB (00:01–24:00).</div>
      </section>

      {printMode ? (
        <section className="print-only min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold">Detail Bulanan</div>
          <div className="mt-1 text-xs text-zinc-600">
            Range: {dayKeys[0]} – {dayKeys[dayKeys.length - 1]} ({dayKeys.length} hari) • WIB
          </div>

          <div className="mt-4 grid gap-6">
            <div className="grid gap-2">
              <div className="text-sm font-semibold">Rekap Harian (1 bulan)</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Booking</th>
                      <th className="px-3 py-2 text-left">Pembayaran Disubmit</th>
                      <th className="px-3 py-2 text-left">Tervalidasi</th>
                      <th className="px-3 py-2 text-left">Dokumen Legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayKeys.map((k, i) => (
                      <tr key={k} className="border-t border-zinc-200">
                        <td className="px-3 py-2 font-medium">{k}</td>
                        <td className="px-3 py-2 text-zinc-700">{(bookingSeries[i] ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-zinc-700">{(paymentSeries[i] ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-zinc-700">{(validatedSeries[i] ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-zinc-700">{(legalSeries[i] ?? 0).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Aktivitas (booking/pembayaran) (1 bulan) (maks {PRINT_TAKE.toLocaleString("id-ID")})</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Actor</th>
                      <th className="px-3 py-2 text-left">Target</th>
                      <th className="px-3 py-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsPrint.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={6}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      logsPrint.map((l) => (
                        <tr key={l.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2 font-medium">{dayKeyWIB(l.createdAt)}</td>
                          <td className="px-3 py-2 text-zinc-600">
                            {l.createdAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </td>
                          <td className="px-3 py-2 text-zinc-700">{l.action}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.actor?.username ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.targetType ? `${l.targetType}:${l.targetId ?? ""}` : l.targetId ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.message ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {logsPrint.length >= PRINT_TAKE ? (
                <div className="text-xs text-zinc-600">Catatan: data dibatasi {PRINT_TAKE.toLocaleString("id-ID")} baris untuk menjaga ukuran PDF.</div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Booking Disubmit (detail) (1 bulan)</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Lease</th>
                      <th className="px-3 py-2 text-left">Training</th>
                      <th className="px-3 py-2 text-left">Schedule</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingSubmittedPrintRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={9}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      bookingSubmittedPrintRows
                        .sort((a, b) => a.at.getTime() - b.at.getTime())
                        .map(({ id, booking: b, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 font-medium">{dayKeyWIB(at)}</td>
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{b.user.username}</div>
                              <div className="text-xs text-zinc-600">{b.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{b.simulator.category} {b.simulator.name}</td>
                            <td className="px-3 py-2 text-zinc-600">{b.leaseType}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{b.trainingName}</div>
                              <div className="text-xs text-zinc-600">{b.trainingCode}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {b.requestedStartAt && b.requestedEndAt ? (
                                <>
                                  {b.requestedStartAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} – {" "}
                                  {b.requestedEndAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                                </>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{b.status}</td>
                            <td className="px-3 py-2 text-xs text-zinc-600">{b.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Pembayaran Disubmit (detail) (1 bulan)</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSubmittedPrintRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={9}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      paymentSubmittedPrintRows
                        .sort((a, b) => a.at.getTime() - b.at.getTime())
                        .map(({ id, payment: p, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 font-medium">{dayKeyWIB(at)}</td>
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{p.booking.user.username}</div>
                              <div className="text-xs text-zinc-600">{p.booking.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.booking.simulator.category} {p.booking.simulator.name}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.booking.paymentMethod ?? "-"}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.amount.toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.status}</td>
                            <td className="px-3 py-2 text-xs text-zinc-600">{p.bookingId}</td>
                            <td className="px-3 py-2 text-xs text-zinc-600">{p.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Pembayaran Tervalidasi (detail) (1 bulan)</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Validator</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentValidatedPrintRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={9}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      paymentValidatedPrintRows
                        .sort((a, b) => a.at.getTime() - b.at.getTime())
                        .map(({ id, payment: p, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 font-medium">{dayKeyWIB(at)}</td>
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.validatedBy?.username ?? "-"}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{p.booking.user.username}</div>
                              <div className="text-xs text-zinc-600">{p.booking.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.booking.simulator.category} {p.booking.simulator.name}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.amount.toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.status}</td>
                            <td className="px-3 py-2 text-xs text-zinc-600">{p.bookingId}</td>
                            <td className="px-3 py-2 text-xs text-zinc-600">{p.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Dokumen Legal Diterbitkan (detail) (1 bulan) (maks {PRINT_TAKE.toLocaleString("id-ID")})</div>
              <div className="rounded-xl border border-zinc-200" data-print-overflow="visible">
                <table className="w-full text-sm" data-print-table="fixed" data-print-wrap="true">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                      <th className="px-3 py-2 text-left">Doc ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legalPrint.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={6}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      legalPrint.map((d) => (
                        <tr key={d.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2 font-medium">{dayKeyWIB(d.issuedAt)}</td>
                          <td className="px-3 py-2 text-zinc-600">
                            {d.issuedAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{d.type}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.status}</td>
                          <td className="px-3 py-2 text-xs text-zinc-600">{d.bookingId}</td>
                          <td className="px-3 py-2 text-xs text-zinc-600">{d.id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {legalPrint.length >= PRINT_TAKE ? (
                <div className="text-xs text-zinc-600">Catatan: data dibatasi {PRINT_TAKE.toLocaleString("id-ID")} baris untuk menjaga ukuran PDF.</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section id="detail" className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6" data-print-hidden="true">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{useWeeklyChart ? "Detail Minggu" : "Detail Tanggal"}</div>
            <div className="mt-1 text-sm text-zinc-600">
              {selectedWeekKey ? (
                <>
                  {selectedWeekBucket ? `${selectedWeekBucket.dayKeys[0]} – ${selectedWeekBucket.dayKeys[selectedWeekBucket.dayKeys.length - 1]}` : selectedWeekKey} (WIB 00:01–24:00)
                </>
              ) : selectedDayKey ? (
                <>
                  {selectedDayKey} (WIB 00:01–24:00)
                </>
              ) : (
                <>Klik salah satu titik {useWeeklyChart ? "minggu" : "tanggal"} di chart untuk melihat detail.</>
              )}
            </div>
          </div>
          {selectedChartKey ? (
            <a
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50"
              href={`/finance/dashboard/report?from=${encodeURIComponent(dayKeys[0])}&to=${encodeURIComponent(dayKeys[dayKeys.length - 1])}`}
            >
              Tutup Detail
            </a>
          ) : null}
        </div>

        {selectedStart && selectedEndExclusive ? (
          <div className="mt-5 grid gap-6">
            {selectedWeekKey && selectedWeekBreakdown ? (
              <div className="grid gap-2">
                <div className="text-sm font-semibold">Ringkasan Harian (minggu terpilih)</div>
                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="w-full min-w-[660px] text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Booking</th>
                        <th className="px-3 py-2 text-left">Pembayaran Disubmit</th>
                        <th className="px-3 py-2 text-left">Tervalidasi</th>
                        <th className="px-3 py-2 text-left">Dokumen Legal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWeekBreakdown.map((r) => (
                        <tr key={r.key} className="border-t border-zinc-200">
                          <td className="px-3 py-2 font-medium">{r.key}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.bookings.toLocaleString("id-ID")}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.payments.toLocaleString("id-ID")}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.validated.toLocaleString("id-ID")}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.legal.toLocaleString("id-ID")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Aktivitas (booking/pembayaran) (maks 100)</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Actor</th>
                      <th className="px-3 py-2 text-left">Target</th>
                      <th className="px-3 py-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsDetail.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={5}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      logsDetail.map((l) => (
                        <tr key={l.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2 text-zinc-600">
                            {l.createdAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </td>
                          <td className="px-3 py-2 font-medium">{l.action}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.actor?.username ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.targetType ? `${l.targetType}:${l.targetId ?? ""}` : l.targetId ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.message ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Booking Disubmit (detail)</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Lease</th>
                      <th className="px-3 py-2 text-left">Training</th>
                      <th className="px-3 py-2 text-left">Schedule</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingSubmittedRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={8}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      bookingSubmittedRows
                        .sort((a, b) => b.at.getTime() - a.at.getTime())
                        .slice(0, 50)
                        .map(({ id, booking: b, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{b.user.username}</div>
                              <div className="text-xs text-zinc-600">{b.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {b.simulator.category} {b.simulator.name}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{b.leaseType}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{b.trainingName}</div>
                              <div className="text-xs text-zinc-600">{b.trainingCode}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {b.requestedStartAt && b.requestedEndAt ? (
                                <>
                                  {b.requestedStartAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} – {" "}
                                  {b.requestedEndAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                                </>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{b.status}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-600">{b.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Pembayaran Disubmit (detail)</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[1040px] text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSubmittedRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={8}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      paymentSubmittedRows
                        .sort((a, b) => b.at.getTime() - a.at.getTime())
                        .slice(0, 50)
                        .map(({ id, payment: p, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{p.booking.user.username}</div>
                              <div className="text-xs text-zinc-600">{p.booking.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {p.booking.simulator.category} {p.booking.simulator.name}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.booking.paymentMethod ?? "-"}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.amount.toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.status}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-600">{p.bookingId}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-600">{p.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Pembayaran Tervalidasi (detail)</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Validator</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Simulator</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking ID</th>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentValidatedRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={8}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      paymentValidatedRows
                        .sort((a, b) => b.at.getTime() - a.at.getTime())
                        .slice(0, 50)
                        .map(({ id, payment: p, at }) => (
                          <tr key={id} className="border-t border-zinc-200">
                            <td className="px-3 py-2 text-zinc-600">
                              {at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.validatedBy?.username ?? "-"}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{p.booking.user.username}</div>
                              <div className="text-xs text-zinc-600">{p.booking.user.email ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {p.booking.simulator.category} {p.booking.simulator.name}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{p.amount.toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2 text-zinc-600">{p.status}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-600">{p.bookingId}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-600">{p.id}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Dokumen Legal Diterbitkan (maks 50)</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Jam (WIB)</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Booking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legalDetail.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-600" colSpan={4}>
                          Tidak ada.
                        </td>
                      </tr>
                    ) : (
                      legalDetail.map((d) => (
                        <tr key={d.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2 text-zinc-600">
                            {d.issuedAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </td>
                          <td className="px-3 py-2 font-medium">{d.type}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.status}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.bookingId}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
