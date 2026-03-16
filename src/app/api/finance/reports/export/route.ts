import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_START_SHIFT_MS = WIB_OFFSET_MS - 60 * 1000; // 00:01 boundary

function dayKeyWIB(dt: Date) {
  return new Date(dt.getTime() + DAY_START_SHIFT_MS).toISOString().slice(0, 10);
}

function isDayKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function dayStartFromKeyWIB(key: string) {
  return new Date(`${key}T00:01:00+07:00`);
}

function lastNDaysWIB(n: number) {
  const now = new Date();
  const todayKey = dayKeyWIB(now);
  const todayStart = dayStartFromKeyWIB(todayKey);

  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKeyWIB(d));
  }
  return { fromKey: days[0], toKey: days[days.length - 1], dayKeys: days };
}

function rangeDaysWIB(fromKey: string, toKey: string, maxDays = 62) {
  const from = dayStartFromKeyWIB(fromKey);
  const to = dayStartFromKeyWIB(toKey);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  if (from.getTime() > to.getTime()) return null;

  const keys: string[] = [];
  const cursor = new Date(from);
  let guard = 0;
  while (cursor.getTime() <= to.getTime()) {
    if (guard++ > maxDays) break;
    keys.push(dayKeyWIB(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function countByDay(rows: Array<{ createdAt: Date }>, dayKeys: string[]) {
  const map = new Map<string, number>();
  for (const k of dayKeys) map.set(k, 0);
  for (const r of rows) {
    const k = dayKeyWIB(r.createdAt);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return dayKeys.map((k) => map.get(k) ?? 0);
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  const fallback = lastNDaysWIB(7);
  const fromKey = isDayKey(fromParam) ? fromParam : fallback.fromKey;
  const toKey = isDayKey(toParam) ? toParam : fallback.toKey;

  const dayKeys = rangeDaysWIB(fromKey, toKey) ?? fallback.dayKeys;
  const rangeStart = dayStartFromKeyWIB(dayKeys[0]);
  const rangeEndExclusive = new Date(dayStartFromKeyWIB(dayKeys[dayKeys.length - 1]));
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const [bookingSubmitted, paymentSubmitted, paymentValidated, legalIssued] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "booking.submitted", createdAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "payment.submitted", createdAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "payment.validated", createdAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { createdAt: true },
    }),
    prisma.legalDocument.findMany({
      where: { issuedAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { issuedAt: true },
    }),
  ]);

  const bookingSeries = countByDay(bookingSubmitted, dayKeys);
  const paymentSeries = countByDay(paymentSubmitted, dayKeys);
  const validatedSeries = countByDay(paymentValidated, dayKeys);
  const legalSeries = countByDay(legalIssued.map((d) => ({ createdAt: d.issuedAt })), dayKeys);

  const rows = dayKeys.map((k, i) => ({
    Tanggal: k,
    "Booking Disubmit": bookingSeries[i] ?? 0,
    "Bukti Pembayaran Disubmit": paymentSeries[i] ?? 0,
    "Pembayaran Tervalidasi": validatedSeries[i] ?? 0,
    "Dokumen Legal Diterbitkan": legalSeries[i] ?? 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = `${fromKey}_to_${toKey}`;

  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="laporan_finance_${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
