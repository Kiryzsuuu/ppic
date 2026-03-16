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
      startAt: { gte: from, lt: to },
    },
    include: { simulator: true },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  return jsonOk({
    slots: slots.map((s) => ({
      id: s.id,
      startAt: s.startAt,
      endAt: s.endAt,
      status: s.status,
      simulator: { category: s.simulator.category, name: s.simulator.name },
    })),
  });
}
