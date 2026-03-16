import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function parseWibDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid --date (expected YYYY-MM-DD): ${dateKey}`);
  const from = new Date(`${dateKey}T00:00:00.000+07:00`);
  const to = new Date(`${dateKey}T23:59:59.999+07:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) throw new Error(`Invalid date: ${dateKey}`);
  return { from, to };
}

function parseWibTimeHHMM(t: string): { h: number; m: number } {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) throw new Error(`Invalid time (expected HH:MM): ${t}`);
  return { h: Number(m[1]), m: Number(m[2]) };
}

function wibDateTime(dateKey: string, timeHHMM: string) {
  const { h, m } = parseWibTimeHHMM(timeHHMM);
  const d = new Date(`${dateKey}T00:00:00.000+07:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function fmt(d: Date) {
  return d.toISOString();
}

function lockTag(locked: boolean) {
  return locked ? " [LOCKED_BY_DRY]" : "";
}

async function main() {
  const simulatorId = getArgValue("--simulatorId");
  const date = getArgValue("--date");
  const windowFrom = getArgValue("--from");
  const windowTo = getArgValue("--to");

  if (!simulatorId || !date) {
    console.error(
      "Usage: tsx scripts/inspect-simulator-day.ts --simulatorId=<id> --date=YYYY-MM-DD [--from=HH:MM --to=HH:MM]"
    );
    process.exit(2);
  }

  const day = parseWibDateKey(date);

  let from = day.from;
  let to = day.to;

  if (windowFrom && windowTo) {
    from = wibDateTime(date, windowFrom);
    to = wibDateTime(date, windowTo);
    if (!(from < to)) throw new Error("Window invalid: from must be earlier than to");
  } else if (windowFrom || windowTo) {
    throw new Error("Provide both --from and --to, or neither.");
  }

  // WET sessions (WIB)
  const wetMorning = { start: wibDateTime(date, "07:30"), end: wibDateTime(date, "11:30") };
  const wetAfternoon = { start: wibDateTime(date, "11:45"), end: wibDateTime(date, "15:45") };

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const sim = await prisma.simulator.findUnique({
      where: { id: simulatorId },
      select: { id: true, name: true, category: true },
    });

    console.log(`[inspect] simulatorId=${simulatorId} (${sim ? `${String(sim.category)} ${sim.name}` : "NOT_FOUND"})`);
    console.log(`[inspect] day=${date} window=${fmt(from)}..${fmt(to)}`);

    const [slots, dryBookings] = await Promise.all([
      prisma.scheduleSlot.findMany({
        where: {
          simulatorId,
          startAt: { lt: to },
          endAt: { gt: from },
        },
        select: { id: true, startAt: true, endAt: true, status: true, bookingId: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.booking.findMany({
        where: {
          simulatorId,
          leaseType: "DRY",
          status: { in: ["CONFIRMED", "COMPLETED"] },
          requestedStartAt: { not: null, lt: to },
          requestedEndAt: { not: null, gt: from },
        },
        select: { id: true, requestedStartAt: true, requestedEndAt: true, status: true },
        orderBy: { requestedStartAt: "asc" },
      }),
    ]);

    console.log(`[inspect] scheduleSlots(overlap window)=${slots.length}`);
    for (const s of slots) {
      const lockedByDry = dryBookings.some((b) =>
        overlaps(s.startAt, s.endAt, b.requestedStartAt!, b.requestedEndAt!)
      );

      const tagMorning = overlaps(s.startAt, s.endAt, wetMorning.start, wetMorning.end) &&
        s.startAt.getTime() === wetMorning.start.getTime() &&
        s.endAt.getTime() === wetMorning.end.getTime()
        ? " (WET_MORNING)"
        : "";
      const tagAfternoon = overlaps(s.startAt, s.endAt, wetAfternoon.start, wetAfternoon.end) &&
        s.startAt.getTime() === wetAfternoon.start.getTime() &&
        s.endAt.getTime() === wetAfternoon.end.getTime()
        ? " (WET_AFTERNOON)"
        : "";

      console.log(
        `- slot=${s.id} ${fmt(s.startAt)}..${fmt(s.endAt)} status=${s.status} bookingId=${s.bookingId ?? "-"}${tagMorning}${tagAfternoon}${lockTag(lockedByDry)}`
      );
    }

    console.log(`[inspect] dryBookings(CONFIRMED/COMPLETED overlap window)=${dryBookings.length}`);
    for (const b of dryBookings) {
      console.log(`- booking=${b.id} ${fmt(b.requestedStartAt!)}..${fmt(b.requestedEndAt!)} status=${b.status}`);
    }

    console.log(`[inspect] wetSessions(${date})`);
    console.log(`- morning ${fmt(wetMorning.start)}..${fmt(wetMorning.end)}`);
    console.log(`- afternoon ${fmt(wetAfternoon.start)}..${fmt(wetAfternoon.end)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[inspect] failed", e);
  process.exit(1);
});
