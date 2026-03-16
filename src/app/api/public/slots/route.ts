import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId") || undefined;

  const now = new Date();
  const from = parseDateOrNull(url.searchParams.get("from")) ?? now;
  const to =
    parseDateOrNull(url.searchParams.get("to")) ??
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      ...(simulatorId ? { simulatorId } : null),
      startAt: { lt: to },
      endAt: { gt: from },
    },
    include: { simulator: true },
    orderBy: { startAt: "asc" },
    take: 200,
  });

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

  return jsonOk({
    slots: [
      ...slots.map((s) => ({
        id: s.id,
        startAt: s.startAt,
        endAt: s.endAt,
        status: s.status,
        leaseType: "WET" as const,
        simulator: { category: s.simulator.category, name: s.simulator.name },
      })),
      ...dryBookings
        .filter((b) => b.requestedStartAt && b.requestedEndAt)
        .map((b) => ({
          id: `booking:${b.id}`,
          startAt: b.requestedStartAt as Date,
          endAt: b.requestedEndAt as Date,
          status: "BOOKED" as const,
          leaseType: "DRY" as const,
          simulator: { category: b.simulator.category, name: b.simulator.name },
        })),
    ],
  });
}
