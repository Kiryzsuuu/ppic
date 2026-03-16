import "dotenv/config";

import { PrismaClient, type Prisma } from "@prisma/client";

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name);
}

function wibDateTime(dateKey: string, timeHHMM: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateKey}`);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeHHMM)) throw new Error(`Invalid time (expected HH:MM): ${timeHHMM}`);
  return new Date(`${dateKey}T${timeHHMM}:00.000+07:00`);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

type Session = { key: "MORNING" | "AFTERNOON"; startAt: Date; endAt: Date };

async function main() {
  const date = getArgValue("--date");
  const simulatorId = getArgValue("--simulatorId");
  const apply = hasFlag("--apply");

  if (!date) {
    console.error(
      "Usage: tsx scripts/split-long-slots-into-sessions.ts --date=YYYY-MM-DD [--simulatorId=<id>] [--apply]"
    );
    console.error("Default is DRY RUN. Use --apply to write changes.");
    process.exit(2);
  }

  const dayStart = wibDateTime(date, "00:00");
  const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

  const fullDayStart = wibDateTime(date, "07:30");
  const fullDayEnd = wibDateTime(date, "15:45");

  const sessions: Session[] = [
    { key: "MORNING", startAt: wibDateTime(date, "07:30"), endAt: wibDateTime(date, "11:30") },
    { key: "AFTERNOON", startAt: wibDateTime(date, "11:45"), endAt: wibDateTime(date, "15:45") },
  ];

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const whereBase: Prisma.ScheduleSlotWhereInput = {
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    };
    if (simulatorId) whereBase.simulatorId = simulatorId;

    const slots = await prisma.scheduleSlot.findMany({
      where: whereBase,
      select: {
        id: true,
        simulatorId: true,
        startAt: true,
        endAt: true,
        status: true,
        bookingId: true,
        createdByAdminId: true,
        simulator: { select: { name: true, category: true } },
      },
      orderBy: [{ simulatorId: "asc" }, { startAt: "asc" }],
    });

    const bySimulator = new Map<string, typeof slots>();
    for (const s of slots) {
      const list = bySimulator.get(s.simulatorId) ?? [];
      list.push(s);
      bySimulator.set(s.simulatorId, list);
    }

    let candidates = 0;
    let splitOk = 0;
    let deletedLongOnly = 0;
    let skippedBooked = 0;
    let skippedConflicts = 0;
    let skippedNotExact = 0;

    for (const [simId, simSlots] of bySimulator.entries()) {
      const longSlots = simSlots.filter(
        (s) => s.startAt.getTime() === fullDayStart.getTime() && s.endAt.getTime() === fullDayEnd.getTime()
      );

      if (longSlots.length === 0) continue;

      for (const long of longSlots) {
        candidates++;

        const simLabel = `${String(long.simulator.category)} ${long.simulator.name}`;

        if (long.bookingId) {
          skippedBooked++;
          console.log(`[split] SKIP booked long slot=${long.id} simulator=${simLabel}`);
          continue;
        }

        const existingMorning = simSlots.find(
          (s) => s.startAt.getTime() === sessions[0].startAt.getTime() && s.endAt.getTime() === sessions[0].endAt.getTime()
        );
        const existingAfternoon = simSlots.find(
          (s) => s.startAt.getTime() === sessions[1].startAt.getTime() && s.endAt.getTime() === sessions[1].endAt.getTime()
        );

        // If the proper session slots already exist, just delete the long slot.
        if (existingMorning && existingAfternoon) {
          console.log(
            `[split] ${apply ? "DELETE" : "DRY"} long slot only (sessions already exist) slot=${long.id} simulator=${simLabel}`
          );
          if (apply) {
            await prisma.scheduleSlot.delete({ where: { id: long.id } });
          }
          deletedLongOnly++;
          continue;
        }

        // Ensure the long slot lines up exactly with the expected full-day span.
        if (long.startAt.getTime() !== fullDayStart.getTime() || long.endAt.getTime() !== fullDayEnd.getTime()) {
          skippedNotExact++;
          console.log(`[split] SKIP not-exact slot=${long.id} simulator=${simLabel}`);
          continue;
        }

        // Verify that splitting won't collide with other slots (excluding the long slot itself).
        const others = simSlots.filter((s) => s.id !== long.id);
        const wouldConflict = sessions.some((sess) =>
          others.some((o) => overlaps(o.startAt, o.endAt, sess.startAt, sess.endAt))
        );

        if (wouldConflict) {
          skippedConflicts++;
          console.log(`[split] SKIP conflicts slot=${long.id} simulator=${simLabel}`);
          continue;
        }

        const createData = sessions.map((sess) => ({
          simulatorId: simId,
          startAt: sess.startAt,
          endAt: sess.endAt,
          status: "AVAILABLE" as const,
          createdByAdminId: long.createdByAdminId,
        }));

        console.log(
          `[split] ${apply ? "APPLY" : "DRY"} split long slot=${long.id} simulator=${simLabel} -> 2 sessions`
        );

        if (apply) {
          await prisma.$transaction(async (tx) => {
            await tx.scheduleSlot.delete({ where: { id: long.id } });
            await tx.scheduleSlot.createMany({ data: createData });
          });
        }

        splitOk++;
      }
    }

    console.log(
      `[split] done apply=${apply} | candidates=${candidates} splitOk=${splitOk} deletedLongOnly=${deletedLongOnly} skippedBooked=${skippedBooked} skippedConflicts=${skippedConflicts} skippedNotExact=${skippedNotExact}`
    );

    if (!apply) {
      console.log("[split] This was a DRY RUN. Re-run with --apply to write changes.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[split] failed", e);
  process.exit(1);
});
