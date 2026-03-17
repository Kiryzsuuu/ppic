import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { WET_SESSIONS_WIB, WetSessionKey } from "@/lib/schedule";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

function buildWibDateTime(dateKey: string, min: number) {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+07:00`);
}

function isValidDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const WetInputSchema = z.object({
  leaseType: z.literal("WET"),
  userId: z.string().min(1),
  simulatorId: z.string().min(1),
  dateKey: z.string().refine(isValidDateKey, "dateKey invalid"),
  sessionKey: z.enum(["MORNING", "AFTERNOON"]) as z.ZodType<WetSessionKey>,
  trainingCode: z.enum(["PPC", "TYPE_RATING", "OTHER"]),
  trainingName: z.string().min(2).max(120),
  personCount: z.number().int().min(1).max(2).default(1),
});

const DryInputSchema = z.object({
  leaseType: z.literal("DRY"),
  userId: z.string().min(1),
  simulatorId: z.string().min(1),
  dateKey: z.string().refine(isValidDateKey, "dateKey invalid"),
  deviceType: z.enum(["FFS", "FTD"]),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
});

const StaffBookSchema = z.discriminatedUnion("leaseType", [WetInputSchema, DryInputSchema]);

function isDryAllowedRange(startMin: number, endMin: number) {
  if (!(startMin < endMin)) return false;

  const step = 60;
  const isStep = (m: number) => m % step === (7 * 60 + 30) % step || m % step === (11 * 60 + 45) % step;
  // We allow the exact grid times we show in UI: start times at 07:30/08:30/... and 11:45/12:45/...
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;

  const inMorning = startMin >= 7 * 60 + 30 && endMin <= 11 * 60 + 30;
  const inAfternoon = startMin >= 11 * 60 + 45 && endMin <= 15 * 60 + 45;
  if (!inMorning && !inAfternoon) return false;

  if (inMorning) {
    const allowedStarts = [7 * 60 + 30, 8 * 60 + 30, 9 * 60 + 30, 10 * 60 + 30];
    const allowedEnds = [8 * 60 + 30, 9 * 60 + 30, 10 * 60 + 30, 11 * 60 + 30];
    if (!allowedStarts.includes(startMin)) return false;
    if (!allowedEnds.includes(endMin)) return false;
  }

  if (inAfternoon) {
    const allowedStarts = [11 * 60 + 45, 12 * 60 + 45, 13 * 60 + 45, 14 * 60 + 45];
    const allowedEnds = [12 * 60 + 45, 13 * 60 + 45, 14 * 60 + 45, 15 * 60 + 45];
    if (!allowedStarts.includes(startMin)) return false;
    if (!allowedEnds.includes(endMin)) return false;
  }

  // also require hour-grid step alignment
  if (!isStep(startMin) || !isStep(endMin)) return false;

  return true;
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = StaffBookSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) return jsonError("User tidak ditemukan", 404);

    const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!profile) return jsonError("Profil user belum ada", 409);

    const ip = getClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");

    if (input.leaseType === "WET") {
      const sessionDef = WET_SESSIONS_WIB[input.sessionKey];
      const startAt = buildWibDateTime(input.dateKey, sessionDef.startMin);
      const endAt = buildWibDateTime(input.dateKey, sessionDef.endMin);

      const slot = await prisma.scheduleSlot.findFirst({
        where: {
          simulatorId: input.simulatorId,
          startAt,
          endAt,
          status: "AVAILABLE",
          bookingId: null,
        },
        select: { id: true, simulatorId: true, startAt: true, endAt: true },
      });

      if (!slot) {
        return jsonError(
          "Slot sesi WET belum tersedia/AVAILABLE untuk tanggal tersebut. Buat slot sesi dulu di Admin Jadwal.",
          409,
        );
      }

      const dryConflict = await prisma.booking.findFirst({
        where: {
          simulatorId: slot.simulatorId,
          leaseType: "DRY",
          status: { in: ["CONFIRMED", "COMPLETED"] },
          requestedStartAt: { not: null, lt: slot.endAt },
          requestedEndAt: { not: null, gt: slot.startAt },
        },
        select: { id: true },
      });
      if (dryConflict) return jsonError("Slot sesi bentrok dengan booking Dry Leased yang sudah terkonfirmasi", 409);

      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const booking = await tx.booking.create({
          data: {
            userId: user.id,
            simulatorId: slot.simulatorId,
            leaseType: "WET",
            trainingCode: input.trainingCode,
            trainingName: input.trainingName,
            personCount: input.personCount,
            paymentMethod: "QRIS",
            preferredSlotId: slot.id,
            requestedStartAt: slot.startAt,
            requestedEndAt: slot.endAt,
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
          select: { id: true, userId: true },
        });

        const updatedSlot = await tx.scheduleSlot.update({
          where: { id: slot.id },
          data: { status: "BOOKED", bookingId: booking.id },
          select: { id: true, status: true, bookingId: true },
        });

        return { booking, slot: updatedSlot };
      });

      try {
        await writeAuditLog({
          actorId: session.userId,
          actorRole: session.role,
          action: "admin.booking.staff_book",
          targetType: "Booking",
          targetId: created.booking.id,
          ip,
          userAgent,
          metadata: {
            leaseType: "WET",
            simulatorId: input.simulatorId,
            dateKey: input.dateKey,
            sessionKey: input.sessionKey,
            slotId: slot.id,
          },
        });
      } catch {
        // ignore
      }

      try {
        await createNotification({
          userId: created.booking.userId,
          kind: "SCHEDULE",
          title: "Jadwal ditetapkan oleh admin",
          body: "Admin telah menetapkan jadwal simulator untuk Anda.",
          metadata: { bookingId: created.booking.id, slotId: slot.id },
        });
      } catch {
        // ignore
      }

      return jsonOk(created);
    }

    // DRY
    if (!isDryAllowedRange(input.startMin, input.endMin)) {
      return jsonError("Range jam DRY tidak valid (harus mengikuti grid DRY).", 400);
    }

    const startAt = buildWibDateTime(input.dateKey, input.startMin);
    const endAt = buildWibDateTime(input.dateKey, input.endMin);

    const dryOverlap = await prisma.booking.findFirst({
      where: {
        simulatorId: input.simulatorId,
        leaseType: "DRY",
        status: { in: ["CONFIRMED", "COMPLETED"] },
        requestedStartAt: { not: null, lt: endAt },
        requestedEndAt: { not: null, gt: startAt },
      },
      select: { id: true },
    });
    if (dryOverlap) return jsonError("Jadwal DRY bentrok dengan booking DRY lain yang sudah terkonfirmasi", 409);

    const wetBookedOverlap = await prisma.scheduleSlot.findFirst({
      where: {
        simulatorId: input.simulatorId,
        status: "BOOKED",
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (wetBookedOverlap) return jsonError("Jadwal DRY bentrok dengan jadwal WET yang sudah dibooking", 409);

    const created = await prisma.booking.create({
      data: {
        userId: user.id,
        simulatorId: input.simulatorId,
        leaseType: "DRY",
        trainingCode: "OTHER",
        trainingName: `Dry Leased (${input.deviceType})`,
        deviceType: input.deviceType,
        personCount: 1,
        paymentMethod: "QRIS",
        preferredSlotId: null,
        requestedStartAt: startAt,
        requestedEndAt: endAt,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      select: { id: true, userId: true },
    });

    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.booking.staff_book",
        targetType: "Booking",
        targetId: created.id,
        ip,
        userAgent,
        metadata: {
          leaseType: "DRY",
          simulatorId: input.simulatorId,
          dateKey: input.dateKey,
          startMin: input.startMin,
          endMin: input.endMin,
          deviceType: input.deviceType,
        },
      });
    } catch {
      // ignore
    }

    try {
      await createNotification({
        userId: created.userId,
        kind: "SCHEDULE",
        title: "Jadwal ditetapkan oleh admin",
        body: "Admin telah menetapkan jadwal simulator untuk Anda.",
        metadata: { bookingId: created.id },
      });
    } catch {
      // ignore
    }

    return jsonOk({ booking: created });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
