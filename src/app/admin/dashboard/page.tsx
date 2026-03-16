import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";
import NotificationsWidget from "@/app/NotificationsWidget";
import ScheduleSnapshot from "./ScheduleSnapshot";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_START_SHIFT_MS = WIB_OFFSET_MS - 60 * 1000; // 00:01 boundary

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

function MiniBarChart(props: {
  title: string;
  days: Array<{ key: string; label: string }>;
  dayKeys: string[];
  series: number[];
  max: number;
  barClassName: string;
}) {
  const { title, days, dayKeys, series, max, barClassName } = props;

  const n = series.length;
  const isLong = n > 14;

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-200 bg-white" />
          <div className="min-w-0 text-sm font-medium truncate">{title}</div>
        </div>
      </div>

      <div className="mt-2 pb-2">
        {isLong ? (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <div className="flex w-max min-w-full items-end gap-2">
              {series.map((v, idx) => (
                <div key={dayKeys[idx]} className="flex w-11 shrink-0 flex-col items-center gap-1">
                  <div className={`w-full rounded-md ${barClassName}`} style={{ height: `${Math.round((v / max) * 56) + 4}px` }} />
                  <div className="whitespace-nowrap text-[10px] text-zinc-600">{days[idx].label}</div>
                  <div className="whitespace-nowrap text-[10px] text-zinc-500">{v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` }}>
            {series.map((v, idx) => (
              <div key={dayKeys[idx]} className="flex min-w-0 flex-col items-center gap-1">
                <div className={`w-full rounded-md ${barClassName}`} style={{ height: `${Math.round((v / max) * 56) + 4}px` }} />
                <div className="whitespace-nowrap text-[10px] text-zinc-600">{days[idx].label}</div>
                <div className="whitespace-nowrap text-[10px] text-zinc-500">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const fromParam = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const toParam = Array.isArray(sp.to) ? sp.to[0] : sp.to;

  const defaultDays = lastNDaysWIB(7);
  const fallbackFrom = defaultDays[0]?.key;
  const fallbackTo = defaultDays[defaultDays.length - 1]?.key;

  const fromKey = fromParam && isDayKey(fromParam) ? fromParam : fallbackFrom;
  const toKey = toParam && isDayKey(toParam) ? toParam : fallbackTo;

  const days = fromKey && toKey ? rangeDaysWIB(fromKey, toKey) ?? defaultDays : defaultDays;
  const dayKeys = days.map((d) => d.key);
  const rangeStart = days[0].start;
  const rangeEnd = days[days.length - 1].end;

  const reportHref = `/admin/dashboard/report?from=${encodeURIComponent(dayKeys[0])}&to=${encodeURIComponent(
    dayKeys[dayKeys.length - 1]
  )}`;

  const pendingDocumentsCount = await prisma.document.count({
    where: { status: "PENDING", type: { not: "PHOTO" } },
  });

  const [usersCreated, bookingSubmitted, paymentSubmitted, paymentValidated] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true },
    }),
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
  ]);

  const usersSeries = countByDay(usersCreated, dayKeys);
  const bookingSeries = countByDay(bookingSubmitted, dayKeys);
  const paymentSeries = countByDay(paymentSubmitted, dayKeys);
  const validatedSeries = countByDay(paymentValidated, dayKeys);

  const maxUsers = Math.max(1, ...usersSeries);
  const maxBookings = Math.max(1, ...bookingSeries);
  const maxPayments = Math.max(1, ...paymentSeries);
  const maxValidated = Math.max(1, ...validatedSeries);

  const pendingBookings = await prisma.booking.findMany({
    where: { status: "WAIT_ADMIN_VERIFICATION" },
    include: { user: { select: { username: true } }, simulator: true },
    orderBy: { requestedAt: "desc" },
    take: 20,
  });

  return (
    <div className="grid w-full min-w-0 max-w-full gap-6">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Admin</h1>
          <p className="mt-1 text-sm text-zinc-600">Verifikasi dokumen, pantau booking, dan terbitkan sertifikat.</p>
        </div>
      </div>

      <a
        className="block min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/admin/verifications"
        aria-label="Buka modul verifikasi dokumen"
      >
        <div className="text-sm font-semibold">Verifikasi Dokumen</div>
        <div className="mt-3 text-sm text-zinc-600">Pending dokumen: {pendingDocumentsCount}</div>
      </a>

      <a
        className="block min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/admin/users"
        aria-label="Buka modul manajemen user"
      >
        <div className="text-sm font-semibold">Manajemen User</div>
        <div className="mt-2 text-sm text-zinc-600">Atur role, reset password, dan pantau last login.</div>
      </a>

      <a
        className="block min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/admin/landing"
        aria-label="Atur gambar landing page"
      >
        <div className="text-sm font-semibold">Landing Page</div>
        <div className="mt-2 text-sm text-zinc-600">Ganti gambar hero slideshow dan logo simulator.</div>
      </a>

      <ScheduleSnapshot />

      <NotificationsWidget title="Notifikasi Saya" compact />

      <section className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Ringkasan (WIB 00:01–24:00)</div>
            <div className="mt-1 text-sm text-zinc-600">Trend aktivitas untuk monitoring cepat.</div>
          </div>
          <form className="w-full sm:w-auto" method="GET" action="/admin/dashboard">
            <div className="grid grid-cols-1 gap-3 sm:flex sm:items-end sm:justify-end">
              <label className="grid gap-1">
                <span className="text-[11px] text-zinc-600">Dari</span>
                <input
                  name="from"
                  type="date"
                  defaultValue={days[0]?.key}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-zinc-600">Sampai</span>
                <input
                  name="to"
                  type="date"
                  defaultValue={days[days.length - 1]?.key}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm font-medium leading-none text-white hover:bg-zinc-800 sm:w-auto"
              >
                Terapkan
              </button>

              <a
                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium leading-none text-zinc-900 hover:bg-zinc-50 sm:w-auto"
                href={reportHref}
              >
                Laporan
              </a>
            </div>
            <div className="mt-2 text-xs text-zinc-600 sm:text-right">
              Range: {dayKeys[0]} – {dayKeys[dayKeys.length - 1]} ({dayKeys.length} hari)
            </div>
          </form>
        </div>

        <div className="mt-5 grid gap-5">
          <MiniBarChart
            title="Registrasi User"
            days={days}
            dayKeys={dayKeys}
            series={usersSeries}
            max={maxUsers}
            barClassName="bg-blue-600"
          />

          <MiniBarChart
            title="Booking Disubmit"
            days={days}
            dayKeys={dayKeys}
            series={bookingSeries}
            max={maxBookings}
            barClassName="bg-emerald-600"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <MiniBarChart
              title="Bukti Pembayaran Disubmit"
              days={days}
              dayKeys={dayKeys}
              series={paymentSeries}
              max={maxPayments}
              barClassName="bg-amber-500"
            />

            <MiniBarChart
              title="Pembayaran Tervalidasi"
              days={days}
              dayKeys={dayKeys}
              series={validatedSeries}
              max={maxValidated}
              barClassName="bg-violet-600"
            />
          </div>
        </div>
      </section>

      <a
        className="block min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/admin/bookings"
        aria-label="Buka modul booking menunggu verifikasi admin"
      >
        <div className="text-sm font-semibold">Booking menunggu verifikasi Admin</div>
        <div className="mt-3 grid gap-2">
          {pendingBookings.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada.</div>
          ) : (
            pendingBookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 font-medium truncate">{b.user.username}</div>
                  <div className="max-w-[55%] truncate text-right text-xs text-zinc-600 sm:max-w-none">
                    {b.simulator.category} {b.simulator.name}
                  </div>
                </div>
                <div className="mt-1 break-words text-sm text-zinc-600">{b.leaseType} • {b.trainingName}</div>
              </div>
            ))
          )}
        </div>
      </a>

      <a
        className="block min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/admin/logs"
        aria-label="Buka audit log"
      >
        <div className="text-sm font-semibold">Audit Log</div>
        <div className="mt-2 text-sm text-zinc-600">Pantau aktivitas penting (login, submit booking, pembayaran, validasi).</div>
      </a>
    </div>
  );
}
