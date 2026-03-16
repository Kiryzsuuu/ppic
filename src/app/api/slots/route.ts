import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import { getWetSessionKeyForRange } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId");
  if (!simulatorId) return jsonError("simulatorId wajib", 400);

  const leaseType = url.searchParams.get("leaseType");

  const now = new Date();

  const slots = await prisma.scheduleSlot.findMany({
    where: {
      simulatorId,
      startAt: { gt: now },
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  // If this is the WET slot picker, only show session slots.
  const baseSlots = leaseType === "WET" ? slots.filter((s) => Boolean(getWetSessionKeyForRange(s.startAt, s.endAt))) : slots;

  // Mark slots as LOCKED in the response if they overlap confirmed DRY bookings.
  const minStart = baseSlots.reduce((min, s) => (s.startAt < min ? s.startAt : min), baseSlots[0]?.startAt ?? now);
  const maxEnd = baseSlots.reduce((max, s) => (s.endAt > max ? s.endAt : max), baseSlots[0]?.endAt ?? now);

  const dryBookings = await prisma.booking.findMany({
    where: {
      simulatorId,
      leaseType: "DRY",
      status: { in: ["CONFIRMED", "COMPLETED"] },
      requestedStartAt: { not: null, lt: maxEnd },
      requestedEndAt: { not: null, gt: minStart },
    },
    select: { id: true, requestedStartAt: true, requestedEndAt: true },
    take: 200,
  });

  const blocked = (slotStart: Date, slotEnd: Date) => {
    const s = slotStart.getTime();
    const e = slotEnd.getTime();
    return dryBookings.some((b) => {
      const bs = (b.requestedStartAt as Date | null)?.getTime();
      const be = (b.requestedEndAt as Date | null)?.getTime();
      if (!bs || !be) return false;
      return bs < e && be > s;
    });
  };

  return jsonOk({
    slots: baseSlots.map((s) => {
      const isBlocked = blocked(s.startAt, s.endAt);
      return {
        ...s,
        status: isBlocked && s.status === "AVAILABLE" ? "LOCKED" : s.status,
      };
    }),
  });
}
