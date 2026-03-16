import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getWetSessionKeyForRange } from "@/lib/schedule";

const CreateSlotSchema = z.object({
  simulatorId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const url = new URL(req.url);
  const simulatorId = url.searchParams.get("simulatorId") || undefined;

  const slots = await prisma.scheduleSlot.findMany({
    where: simulatorId ? { simulatorId } : undefined,
    include: { simulator: true, booking: { include: { user: { select: { username: true } } } } },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  return jsonOk({ slots });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = CreateSlotSchema.parse(body);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!(startAt < endAt)) return jsonError("Waktu mulai harus lebih awal dari waktu selesai.", 400);

    if (!getWetSessionKeyForRange(startAt, endAt)) {
      return jsonError(
        "Slot harus sesuai sesi WET (07:30–11:30 atau 11:45–15:45 WIB).",
        400,
      );
    }

    const dryConflict = await prisma.booking.findFirst({
      where: {
        simulatorId: input.simulatorId,
        leaseType: "DRY",
        status: { in: ["CONFIRMED", "COMPLETED"] },
        requestedStartAt: { not: null, lt: endAt },
        requestedEndAt: { not: null, gt: startAt },
      },
      select: { id: true },
    });
    if (dryConflict) return jsonError("Slot bentrok dengan booking Dry Leased yang sudah terkonfirmasi", 409);

    const conflict = await prisma.scheduleSlot.findFirst({
      where: {
        simulatorId: input.simulatorId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) return jsonError("Slot bentrok dengan slot lain", 409);

    const slot = await prisma.scheduleSlot.create({
      data: {
        simulatorId: input.simulatorId,
        startAt,
        endAt,
        status: "AVAILABLE",
        createdByAdminId: session.userId,
      },
      include: { simulator: true },
    });

    return jsonOk({ slot });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
