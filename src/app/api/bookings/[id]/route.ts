import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      simulator: true,
      payment: true,
      slot: true,
      legalDocument: true,
      logbookEntries: { orderBy: { createdAt: "desc" } },
      certificate: true,
      user: { select: { id: true, username: true } },
    },
  });

  if (!booking) return jsonError("Booking tidak ditemukan", 404);

  const isOwner = session.role === "USER" && booking.userId === session.userId;
  const isStaff = session.role !== "USER";
  if (!isOwner && !isStaff) return jsonError("Forbidden", 403);

  return jsonOk({ booking });
}
