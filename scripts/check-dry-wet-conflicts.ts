import "dotenv/config";

import { PrismaClient } from "@prisma/client";

type Args = {
  from?: string;
  to?: string;
  simulatorId?: string;
  limit?: number;
};

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name);
}

function parseIntArg(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateOrWibDateKey(input: string): Date {
  // Accept full ISO strings, or date keys YYYY-MM-DD interpreted as start-of-day WIB.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(`${input}T00:00:00.000+07:00`);
    if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date key: ${input}`);
    return d;
  }

  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date: ${input}`);
  return d;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

async function main() {
  const args: Args = {
    from: getArgValue("--from"),
    to: getArgValue("--to"),
    simulatorId: getArgValue("--simulatorId"),
    limit: parseIntArg(getArgValue("--limit")) ?? 50,
  };

  const failOnOverlap = hasFlag("--fail");

  const now = new Date();
  const from = args.from ? parseDateOrWibDateKey(args.from) : addDays(now, -1);
  const to = args.to ? parseDateOrWibDateKey(args.to) : addDays(now, 30);
  if (!(from < to)) throw new Error("`from` must be earlier than `to`.");

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const bookingWhere: any = {
      leaseType: "DRY",
      status: { in: ["CONFIRMED", "COMPLETED"] },
      requestedStartAt: { not: null, lt: to },
      requestedEndAt: { not: null, gt: from },
    };
    if (args.simulatorId) bookingWhere.simulatorId = args.simulatorId;

    const slotWhere: any = {
      startAt: { lt: to },
      endAt: { gt: from },
    };
    if (args.simulatorId) slotWhere.simulatorId = args.simulatorId;

    const [dryBookings, slots] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere,
        select: {
          id: true,
          simulatorId: true,
          requestedStartAt: true,
          requestedEndAt: true,
          status: true,
          leaseType: true,
        },
        orderBy: { requestedStartAt: "asc" },
      }),
      prisma.scheduleSlot.findMany({
        where: slotWhere,
        select: {
          id: true,
          simulatorId: true,
          startAt: true,
          endAt: true,
          status: true,
          bookingId: true,
        },
        orderBy: { startAt: "asc" },
      }),
    ]);

    const slotsBySimulator = new Map<string, typeof slots>();
    for (const s of slots) {
      const list = slotsBySimulator.get(s.simulatorId) ?? [];
      list.push(s);
      slotsBySimulator.set(s.simulatorId, list);
    }

    let conflictCount = 0;
    const conflictLines: string[] = [];

    for (const b of dryBookings) {
      const bStart = b.requestedStartAt!;
      const bEnd = b.requestedEndAt!;
      const simSlots = slotsBySimulator.get(b.simulatorId) ?? [];

      for (const s of simSlots) {
        if (!overlaps(s.startAt, s.endAt, bStart, bEnd)) continue;

        conflictCount++;
        if (conflictLines.length < (args.limit ?? 50)) {
          conflictLines.push(
            `- simulator=${b.simulatorId} | booking(DRY)=${b.id} ${bStart.toISOString()}..${bEnd.toISOString()} | slot=${s.id} ${s.startAt.toISOString()}..${s.endAt.toISOString()} status=${s.status} bookingId=${s.bookingId ?? "-"}`
          );
        }
      }
    }

    console.log(
      `[conflicts] window=${from.toISOString()}..${to.toISOString()} simulatorId=${args.simulatorId ?? "*"}`
    );
    console.log(`[conflicts] dryBookings=${dryBookings.length} scheduleSlots=${slots.length}`);

    if (conflictCount === 0) {
      console.log("[conflicts] OK: tidak ada overlap DRY(CONFIRMED/COMPLETED) vs ScheduleSlot");
      return;
    }

    console.warn(`[conflicts] FOUND: ${conflictCount} overlap(s)`);
    for (const line of conflictLines) console.error(line);

    if (conflictCount > conflictLines.length) {
      console.error(`[conflicts] ... dan ${conflictCount - conflictLines.length} konflik lainnya (naikkan --limit untuk lihat lebih banyak)`);
    }

    if (failOnOverlap) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[conflicts] failed", e);
  process.exit(1);
});
