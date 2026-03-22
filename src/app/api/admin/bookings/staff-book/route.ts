import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { WET_SESSIONS_WIB, WetSessionKey } from "@/lib/schedule";
import { createNotification } from "@/lib/notifications";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

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
    const deviceId = getDeviceIdFromHeaders(req.headers);

    if (input.leaseType === "WET") {
      const sessionDef = WET_SESSIONS_WIB[input.sessionKey];
      const startAt = buildWibDateTime(input.dateKey, sessionDef.startMin);
      const endAt = buildWibDateTime(input.dateKey, sessionDef.endMin);

      // Block WET session if overlapping with confirmed DRY bookings.
      const dryConflictForRequestedSession = await prisma.booking.findFirst({
        where: {
          simulatorId: input.simulatorId,
          leaseType: "DRY",
          status: { in: ["CONFIRMED", "COMPLETED"] },
          requestedStartAt: { not: null, lt: endAt },
          requestedEndAt: { not: null, gt: startAt },
        },
        select: { id: true },
      });
      if (dryConflictForRequestedSession) {
        return jsonError("Slot sesi bentrok dengan booking Dry Leased yang sudah terkonfirmasi", 409);
      }

      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Prefer exact session slot. If not present, try auto-splitting an AVAILABLE full-day slot.
          let slot = await tx.scheduleSlot.findFirst({
            where: {
              simulatorId: input.simulatorId,
              startAt,
              endAt,
              status: "AVAILABLE",
              booking: { is: null },
            },
            select: { id: true, simulatorId: true, startAt: true, endAt: true },
          });

          if (!slot) {
            const morningStartAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.MORNING.startMin);
            const morningEndAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.MORNING.endMin);
            const afternoonStartAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.AFTERNOON.startMin);
            const afternoonEndAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.AFTERNOON.endMin);

            const [existingMorning, existingAfternoon] = await Promise.all([
              tx.scheduleSlot.findFirst({
                where: { simulatorId: input.simulatorId, startAt: morningStartAt, endAt: morningEndAt },
                select: {
                  id: true,
                  simulatorId: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                  bookingId: true,
                  createdByAdminId: true,
                },
              }),
              tx.scheduleSlot.findFirst({
                where: { simulatorId: input.simulatorId, startAt: afternoonStartAt, endAt: afternoonEndAt },
                select: {
                  id: true,
                  simulatorId: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                  bookingId: true,
                  createdByAdminId: true,
                },
              }),
            ]);

            const requestedExisting = input.sessionKey === "MORNING" ? existingMorning : existingAfternoon;
            if (requestedExisting) {
              if (requestedExisting.status === "AVAILABLE" && !requestedExisting.bookingId) {
                slot = {
                  id: requestedExisting.id,
                  simulatorId: requestedExisting.simulatorId,
                  startAt: requestedExisting.startAt,
                  endAt: requestedExisting.endAt,
                };
              } else {
                throw new Error(
                  `Slot WET sesi ${input.sessionKey} sudah ada tetapi tidak AVAILABLE (status=${requestedExisting.status}). Cek Daftar Slot untuk tanggal tersebut.`,
                );
              }
            } else {
              const fullDayStartAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.MORNING.startMin);
              const fullDayEndAt = buildWibDateTime(input.dateKey, WET_SESSIONS_WIB.AFTERNOON.endMin);

              const fullDaySlot = await tx.scheduleSlot.findFirst({
                where: {
                  simulatorId: input.simulatorId,
                  // Legacy data may have a single slot that spans the whole operational day.
                  // Use a coverage check rather than strict equality to ensure we can auto-split.
                  startAt: { lte: fullDayStartAt },
                  endAt: { gte: fullDayEndAt },
                  status: "AVAILABLE",
                  booking: { is: null },
                },
                select: { id: true, createdByAdminId: true },
              });

              if (fullDaySlot) {
                // Split/convert full-day slot into the requested session.
                slot = await tx.scheduleSlot.update({
                  where: { id: fullDaySlot.id },
                  data:
                    input.sessionKey === "MORNING"
                      ? { startAt: morningStartAt, endAt: morningEndAt }
                      : { startAt: afternoonStartAt, endAt: afternoonEndAt },
                  select: { id: true, simulatorId: true, startAt: true, endAt: true },
                });

                // Ensure the other session exists (AVAILABLE) if missing.
                if (input.sessionKey === "MORNING" && !existingAfternoon) {
                  await tx.scheduleSlot.create({
                    data: {
                      simulatorId: input.simulatorId,
                      startAt: afternoonStartAt,
                      endAt: afternoonEndAt,
                      status: "AVAILABLE",
                      createdByAdminId: fullDaySlot.createdByAdminId,
                    },
                    select: { id: true },
                  });
                }
                if (input.sessionKey === "AFTERNOON" && !existingMorning) {
                  await tx.scheduleSlot.create({
                    data: {
                      simulatorId: input.simulatorId,
                      startAt: morningStartAt,
                      endAt: morningEndAt,
                      status: "AVAILABLE",
                      createdByAdminId: fullDaySlot.createdByAdminId,
                    },
                    select: { id: true },
                  });
                }
              } else {
                // Full-day slot may already have been converted into one session; create the missing session from existing adminId.
                const createdByAdminId = existingMorning?.createdByAdminId ?? existingAfternoon?.createdByAdminId;
                if (createdByAdminId) {
                  slot = await tx.scheduleSlot.create({
                    data: {
                      simulatorId: input.simulatorId,
                      startAt,
                      endAt,
                      status: "AVAILABLE",
                      createdByAdminId,
                    },
                    select: { id: true, simulatorId: true, startAt: true, endAt: true },
                  });
                }

                // Legacy/dirty data: an AVAILABLE slot may exist that fully covers the requested session,
                // but its stored start/end are not exactly equal to the session boundaries.
                // Normalize it to the exact session range so downstream logic stays consistent.
                if (!slot) {
                  const coveringSlot = await tx.scheduleSlot.findFirst({
                    where: {
                      simulatorId: input.simulatorId,
                      status: "AVAILABLE",
                      booking: { is: null },
                      startAt: { lte: startAt },
                      endAt: { gte: endAt },
                    },
                    orderBy: [{ startAt: "desc" }, { endAt: "asc" }],
                    select: { id: true },
                  });

                  if (coveringSlot) {
                    const otherOverlap = await tx.scheduleSlot.findFirst({
                      where: {
                        simulatorId: input.simulatorId,
                        id: { not: coveringSlot.id },
                        startAt: { lt: endAt },
                        endAt: { gt: startAt },
                      },
                      select: { id: true, status: true },
                    });
                    if (otherOverlap) {
                      throw new Error(
                        `Sesi WET ${input.sessionKey} bentrok dengan slot lain (slotId=${otherOverlap.id}, status=${otherOverlap.status}). Cek Daftar Slot untuk tanggal tersebut.`,
                      );
                    }

                    slot = await tx.scheduleSlot.update({
                      where: { id: coveringSlot.id },
                      data: { startAt, endAt },
                      select: { id: true, simulatorId: true, startAt: true, endAt: true },
                    });
                  }
                }
              }
            }
          }

          if (!slot) {
            throw new Error(
              "Slot WET belum tersedia/AVAILABLE untuk tanggal tersebut. Untuk WET, sistem butuh slot availability: buat slot sesi (07:30–11:30 / 11:45–15:45) ATAU buat slot full-day (07:30–15:45) agar sistem bisa auto-split.",
            );
          }

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
          deviceId,
          userAgent,
          metadata: {
            leaseType: "WET",
            simulatorId: input.simulatorId,
            dateKey: input.dateKey,
            sessionKey: input.sessionKey,
            slotId: created.slot.id,
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
          metadata: { bookingId: created.booking.id, slotId: created.slot.id },
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
        deviceId,
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
    if (
      e instanceof Error &&
      (e.message.includes("Slot sesi WET belum tersedia") ||
        e.message.includes("Slot WET belum tersedia") ||
        e.message.includes("Slot WET sesi") ||
        e.message.includes("Sesi WET"))
    ) {
      return jsonError(e.message, 409);
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Common concurrency / constraint errors when splitting full-day slots.
      if (e.code === "P2002") {
        return jsonError("Slot sesi sudah ada / bentrok. Refresh data slot lalu coba booking lagi.", 409);
      }
      if (e.code === "P2025") {
        return jsonError("Slot availability berubah (tidak ditemukan saat update). Refresh lalu coba lagi.", 409);
      }
    }

    const msg =
      process.env.NODE_ENV === "production" ? "Server error" : e instanceof Error ? e.message : "Server error";
    return jsonError(msg, 500);
  }
}
