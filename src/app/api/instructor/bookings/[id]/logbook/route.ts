import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const LogbookSchema = z.object({
  notes: z.string().min(3).max(2000),
  result: z.string().min(2).max(300),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = LogbookSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!booking) return jsonError("Booking tidak ditemukan", 404);
    if (booking.leaseType !== "WET") return jsonError("Logbook hanya untuk skema Wet Leased", 400);
    if (!booking.slot) return jsonError("Jadwal belum ditetapkan", 400);
    if (booking.status !== "CONFIRMED") return jsonError("Status booking tidak sesuai", 400);

    const entry = await prisma.logbookEntry.create({
      data: {
        bookingId: booking.id,
        instructorId: session.userId,
        notes: input.notes,
        result: input.result,
      },
    });

    return jsonOk({ entry });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
