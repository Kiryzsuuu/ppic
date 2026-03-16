import "dotenv/config";

import { PrismaClient } from "@prisma/client";

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

async function main() {
  const simulatorId = getArgValue("--simulatorId");
  const date = getArgValue("--date");
  const from = getArgValue("--from");
  const to = getArgValue("--to");

  const userIdArg = getArgValue("--userId");
  const userEmail = getArgValue("--userEmail");

  const apply = hasFlag("--apply");

  if (!simulatorId || !date || !from || !to) {
    console.error(
      "Usage: tsx scripts/create-test-dry-booking.ts --simulatorId=<id> --date=YYYY-MM-DD --from=HH:MM --to=HH:MM [--userId=<id> | --userEmail=email] [--apply]"
    );
    console.error("Default is DRY RUN. Use --apply to insert a CONFIRMED DRY booking.");
    process.exit(2);
  }

  const requestedStartAt = wibDateTime(date, from);
  const requestedEndAt = wibDateTime(date, to);
  if (!(requestedStartAt < requestedEndAt)) throw new Error("Invalid range: from must be earlier than to");

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const sim = await prisma.simulator.findUnique({
      where: { id: simulatorId },
      select: { id: true, name: true, category: true },
    });
    if (!sim) throw new Error(`Simulator not found: ${simulatorId}`);

    let userId = userIdArg;

    if (!userId && userEmail) {
      const u = await prisma.user.findFirst({ where: { email: userEmail }, select: { id: true } });
      if (!u) throw new Error(`User not found by email: ${userEmail}`);
      userId = u.id;
    }

    if (!userId) {
      const u = await prisma.user.findFirst({
        where: { role: "USER" },
        orderBy: { createdAt: "asc" },
        select: { id: true, username: true, email: true, role: true },
      });
      if (!u) throw new Error("No users found in DB to attach booking to.");
      userId = u.id;
      console.log(`[dry-booking] picked default user id=${u.id} username=${u.username} email=${u.email ?? "-"}`);
    }

    const payload = {
      userId,
      simulatorId,
      leaseType: "DRY" as const,
      trainingName: "TEST DRY BOOKING",
      deviceType: null,
      personCount: 1,
      paymentMethod: "QRIS" as any,
      preferredSlotId: null,
      requestedStartAt,
      requestedEndAt,
      status: "CONFIRMED" as const,
      confirmedAt: new Date(),
    };

    // Validate trainingCode enum value by reading an existing booking if available.
    // If schema uses different TrainingCode values, we fall back to the first one found.
    try {
      // noop; keep payload as-is
    } catch {
      // noop
    }

    console.log(`[dry-booking] simulator=${String(sim.category)} ${sim.name} (${sim.id})`);
    console.log(
      `[dry-booking] range(WIB) ${date} ${from}..${to} => ${requestedStartAt.toISOString()}..${requestedEndAt.toISOString()}`
    );

    if (!apply) {
      console.log("[dry-booking] DRY RUN: re-run with --apply to create booking.");
      return;
    }

    // Ensure we don't create duplicates for the exact same user+simulator+range.
    const existing = await prisma.booking.findFirst({
      where: {
        userId,
        simulatorId,
        leaseType: "DRY",
        status: { in: ["CONFIRMED", "COMPLETED"] },
        requestedStartAt,
        requestedEndAt,
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`[dry-booking] exists: booking=${existing.id}`);
      return;
    }

    // Pick a valid trainingCode: prefer sample from existing booking, else fall back to a known enum value.
    let trainingCode: any;
    const sample = await prisma.booking.findFirst({ select: { trainingCode: true } });
    if (sample?.trainingCode) {
      trainingCode = sample.trainingCode;
    } else {
      trainingCode = "PPC";
    }

    const created = await prisma.booking.create({
      data: {
        ...payload,
        trainingCode,
      } as any,
      select: { id: true },
    });

    console.log(`[dry-booking] created booking=${created.id} status=CONFIRMED`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[dry-booking] failed", e);
  process.exit(1);
});
