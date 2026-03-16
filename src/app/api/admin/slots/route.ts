import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

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
