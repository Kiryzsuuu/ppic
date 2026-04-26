import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Generate virtual slots for all simulators in a date range
function generateVirtualSlots(
  from: Date,
  to: Date,
  simulators: Array<{ id: string; category: string; name: string }>
) {
  const slots: Array<{
    id: string;
    simulatorId: string;
    startAt: Date;
    endAt: Date;
    status: "AVAILABLE";
    leaseType: "WET";
    simulator: { category: string; name: string };
  }> = [];

  const operatingHours = [
    { startMin: 7 * 60 + 30, endMin: 11 * 60 + 30 }, // 07:30 - 11:30
    { startMin: 11 * 60 + 45, endMin: 15 * 60 + 45 }, // 11:45 - 15:45
  ];

  // Iterate through each day
  for (let dayMs = from.getTime(); dayMs < to.getTime(); dayMs += 24 * 60 * 60 * 1000) {
    const dayDate = new Date(dayMs);
    const dateKey = dayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    for (const range of operatingHours) {
      for (let min = range.startMin; min + 60 <= range.endMin; min += 60) {
        const hh = String(Math.floor(min / 60)).padStart(2, "0");
        const mm = String(min % 60).padStart(2, "0");
        const hh_end = String(Math.floor((min + 60) / 60)).padStart(2, "0");
        const mm_end = String((min + 60) % 60).padStart(2, "0");

        const startIso = new Date(`${dateKey}T${hh}:${mm}:00+07:00`).toISOString();
        const endIso = new Date(`${dateKey}T${hh_end}:${mm_end}:00+07:00`).toISOString();

        const startAt = new Date(startIso);
        const endAt = new Date(endIso);

        for (const sim of simulators) {
          slots.push({
            id: `virtual:${sim.id}:${startIso}`,
            simulatorId: sim.id,
            startAt,
            endAt,
            status: "AVAILABLE" as const,
            leaseType: "WET" as const,
            simulator: { category: sim.category, name: sim.name },
          });
        }
      }
    }
  }

  return slots;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId") || undefined;

  const now = new Date();
  const from = parseDateOrNull(url.searchParams.get("from")) ?? now;
  const to =
    parseDateOrNull(url.searchParams.get("to")) ??
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch all simulators for virtual slot generation
  const allSimulators = await prisma.simulator.findMany();
  const simulatorsToUse = simulatorId
    ? allSimulators.filter((s) => s.id === simulatorId)
    : allSimulators;

  // Generate virtual slots
  const virtualSlots = generateVirtualSlots(from, to, simulatorsToUse);

  // Fetch real DB slots (BOOKED, LOCKED, or user-created)
  const dbSlots = await prisma.scheduleSlot.findMany({
    where: {
      ...(simulatorId ? { simulatorId } : null),
      startAt: { lt: to },
      endAt: { gt: from },
    },
    include: { simulator: true },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  // Build overlap map: for each DB slot, mark the time range as occupied
  const dbSlotMap = new Map<string, typeof dbSlots[0]>();
  for (const slot of dbSlots) {
    const key = `${slot.simulatorId}:${slot.startAt.getTime()}:${slot.endAt.getTime()}`;
    dbSlotMap.set(key, slot);
  }

  // Merge: real slots override virtual slots with the same time range
  const slotsByKey = new Map<string, any>();
  for (const vslot of virtualSlots) {
    const key = `${vslot.simulatorId}:${vslot.startAt.getTime()}:${vslot.endAt.getTime()}`;
    slotsByKey.set(key, vslot);
  }
  for (const dbSlot of dbSlots) {
    const key = `${dbSlot.simulatorId}:${dbSlot.startAt.getTime()}:${dbSlot.endAt.getTime()}`;
    slotsByKey.set(key, {
      id: dbSlot.id,
      simulatorId: dbSlot.simulatorId,
      startAt: dbSlot.startAt,
      endAt: dbSlot.endAt,
      status: dbSlot.status,
      leaseType: "WET" as const,
      simulator: { category: dbSlot.simulator.category, name: dbSlot.simulator.name },
    });
  }

  // DRY bookings don't create ScheduleSlot rows, so we expose them here as synthetic BOOKED blocks.
  const dryBookings = await prisma.booking.findMany({
    where: {
      ...(simulatorId ? { simulatorId } : null),
      leaseType: "DRY",
      status: { in: ["CONFIRMED", "COMPLETED"] },
      requestedStartAt: { not: null, lt: to },
      requestedEndAt: { not: null, gt: from },
    },
    include: { simulator: true },
    orderBy: { requestedStartAt: "asc" },
    take: 200,
  });

  const drySlots = dryBookings
    .filter((b) => b.requestedStartAt && b.requestedEndAt)
    .map((b) => ({
      id: `booking:${b.id}`,
      startAt: b.requestedStartAt as Date,
      endAt: b.requestedEndAt as Date,
      status: "BOOKED" as const,
      leaseType: "DRY" as const,
      simulator: { category: b.simulator.category, name: b.simulator.name },
    }));

  const allSlots = [...Array.from(slotsByKey.values()), ...drySlots];
  allSlots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return jsonOk({
    slots: allSlots,
  });
}
