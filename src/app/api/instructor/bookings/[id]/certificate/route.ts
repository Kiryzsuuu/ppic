import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

function generateQrValue(bookingId: string) {
  return `PPI-CRT-${bookingId}-${crypto.randomBytes(6).toString("hex")}`;
}

function getSimulatorLabel(sim: { category: string; name: string }) {
  return `${sim.category} ${sim.name}`;
}

const PatchSchema = z.object({
  data: z.record(z.string(), z.unknown()).nullable().optional(),
});

const CreateSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { include: { profile: true } },
      simulator: true,
      slot: true,
      logbookEntries: { orderBy: { createdAt: "desc" }, take: 1 },
      certificate: true,
    },
  });

  if (!booking) return jsonError("Booking tidak ditemukan", 404);

  return jsonOk({ booking });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { include: { profile: true } },
      simulator: true,
      slot: true,
      logbookEntries: { orderBy: { createdAt: "desc" }, take: 1 },
      certificate: true,
    },
  });

  if (!booking) return jsonError("Booking tidak ditemukan", 404);
  if (booking.certificate) return jsonOk({ certificate: booking.certificate, created: false });

  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    return jsonError("Booking belum dapat diterbitkan sertifikat", 400);
  }

  if (!booking.slot) {
    return jsonError("Jadwal slot belum tersedia. Sertifikat hanya bisa dibuat jika booking sudah punya slot.", 400);
  }

  if (booking.leaseType === "WET" && booking.logbookEntries.length === 0) {
    return jsonError("Logbook wajib diisi Instructor sebelum sertifikat diterbitkan (Wet Leased)", 400);
  }

  const profile = booking.user.profile;
  const lastLogbook = booking.logbookEntries[0];

  const baseData = {
    certificateTitle: "SERTIFIKAT",
    certificateSubtitle: "Pelatihan Simulator",
    issuedPlace: "Curug",

    bookingId: booking.id,
    trainingCode: booking.trainingCode,

    recipientName: profile?.fullName || booking.user.username,
    licenseNo: profile?.licenseNo || "",
    trainingName: booking.trainingName,
    simulatorLabel: getSimulatorLabel(booking.simulator),
    scheduleStartAt: booking.slot.startAt.toISOString(),
    scheduleEndAt: booking.slot.endAt.toISOString(),
    result: lastLogbook?.result || "",
    notes: lastLogbook?.notes || "",
  } satisfies Record<string, unknown>;

  // Allow instructor to override defaults at creation time.
  const body = await _req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body ?? {});
  const overrides = parsed.success ? parsed.data.data : undefined;

  const data = {
    ...baseData,
    ...(overrides ?? {}),
    // Always keep these aligned with the booking context by default.
    bookingId: booking.id,
  } satisfies Record<string, unknown>;

  const cert = await prisma.certificate.create({
    data: {
      bookingId: booking.id,
      qrValue: generateQrValue(booking.id),
      issuedById: session.userId,
      data: data as Prisma.InputJsonValue,
    },
  });

  return jsonOk({ certificate: cert, created: true });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Body tidak valid", 400, parsed.error.flatten());

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { certificate: true },
  });

  if (!booking) return jsonError("Booking tidak ditemukan", 404);
  if (!booking.certificate) return jsonError("Sertifikat belum dibuat", 400);

  const nextData = (parsed.data.data ?? null) as Prisma.InputJsonValue | null;

  const cert = await prisma.certificate.update({
    where: { id: booking.certificate.id },
    data: {
      data: nextData,
      issuedById: session.userId,
    },
  });

  return jsonOk({ certificate: cert });
}
