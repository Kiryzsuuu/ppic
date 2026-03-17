import { prisma } from "@/lib/prisma";
import { sendSimulatorReminderEmail } from "@/lib/emails";
import { writeAuditLog } from "@/lib/audit";
import { addDays } from "date-fns";
import { BookingStatus, type Booking, type ScheduleSlot, type Simulator, type User } from "@prisma/client";

const WIB_TZ = "Asia/Jakarta";

const REMINDER_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PAYMENT_VALIDATION,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
];

function getYmdInZone(dt: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error("Gagal membaca tanggal (timezone conversion)");
  }

  return { y, m, d };
}

function toDayOrdinal(ymd: { y: number; m: number; d: number }) {
  return Math.floor(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / 86_400_000);
}

function diffCalendarDaysInZone(from: Date, to: Date, timeZone: string) {
  const a = toDayOrdinal(getYmdInZone(from, timeZone));
  const b = toDayOrdinal(getYmdInZone(to, timeZone));
  return b - a;
}

function getSimulatorLabel(sim: Simulator) {
  return `${sim.category} ${sim.name}`;
}

function getScheduledWindowFromSlot(slot: ScheduleSlot | null) {
  if (!slot) return null;
  return { startAt: slot.startAt, endAt: slot.endAt };
}

export type RunRemindersInput = {
  dryRun?: boolean;
  limit?: number;
};

export type RunRemindersResult = {
  ok: boolean;
  nowIso: string;
  dryRun: boolean;
  scanned: number;
  candidates: number;
  sent: number;
  skippedNoEmail: number;
  skippedUnverifiedEmail: number;
  skippedAlreadySent: number;
  skippedNoSchedule: number;
  errors: Array<{ bookingId: string; reason: string }>;
};

type BookingWithRefs = Booking & {
  user: User;
  simulator: Simulator;
  slot: ScheduleSlot | null;
};

export async function runSimulatorReminders(input: RunRemindersInput = {}): Promise<RunRemindersResult> {
  const dryRun = Boolean(input.dryRun);
  const limit = input.limit ?? 500;

  const now = new Date();
  const upper = addDays(now, 4);

  const bookings: BookingWithRefs[] = await prisma.booking.findMany({
    where: {
      status: { in: REMINDER_STATUSES },
      slot: { is: { startAt: { gte: now, lt: upper } } },
    },
    include: {
      user: true,
      simulator: true,
      slot: true,
    },
    take: limit,
    orderBy: { requestedAt: "asc" },
  });

  const errors: RunRemindersResult["errors"] = [];
  let candidates = 0;
  let sent = 0;
  let skippedNoEmail = 0;
  let skippedUnverifiedEmail = 0;
  let skippedAlreadySent = 0;
  let skippedNoSchedule = 0;

  // Precompute which bookings need which reminder.
  const wantReminderByBookingId = new Map<string, 0 | 1 | 2 | 3>();
  for (const b of bookings) {
    const win = getScheduledWindowFromSlot(b.slot);
    if (!win) {
      skippedNoSchedule++;
      continue;
    }

    // For H-0 (Hari H), only send if the session hasn't started yet.
    if (win.startAt <= now) continue;

    const daysBefore = diffCalendarDaysInZone(now, win.startAt, WIB_TZ);
    if (daysBefore === 0 || daysBefore === 1 || daysBefore === 2 || daysBefore === 3) {
      wantReminderByBookingId.set(b.id, daysBefore);
    }
  }

  const bookingIds = [...wantReminderByBookingId.keys()];
  candidates = bookingIds.length;

  const auditRows = bookingIds.length
    ? await prisma.auditLog.findMany({
        where: {
          targetType: "Booking",
          targetId: { in: bookingIds },
          action: {
            in: [
              "EMAIL_SIMULATOR_REMINDER_H0",
              "EMAIL_SIMULATOR_REMINDER_H1",
              "EMAIL_SIMULATOR_REMINDER_H2",
              "EMAIL_SIMULATOR_REMINDER_H3",
            ],
          },
        },
        select: { action: true, targetId: true },
      })
    : [];

  const alreadySent = new Set(auditRows.map((r) => `${r.targetId}:${r.action}`));

  for (const b of bookings) {
    const daysBefore = wantReminderByBookingId.get(b.id);
    if (daysBefore === undefined) continue;

    const to = b.user.email?.trim();
    if (!to) {
      skippedNoEmail++;
      continue;
    }

    if (!b.user.emailVerifiedAt) {
      skippedUnverifiedEmail++;
      continue;
    }

    const win = getScheduledWindowFromSlot(b.slot);
    if (!win) {
      skippedNoSchedule++;
      continue;
    }

    const action = `EMAIL_SIMULATOR_REMINDER_H${daysBefore}` as const;
    const sentKey = `${b.id}:${action}`;
    if (alreadySent.has(sentKey)) {
      skippedAlreadySent++;
      continue;
    }

    try {
      if (!dryRun) {
        await sendSimulatorReminderEmail({
          to,
          name: b.user.username,
          bookingId: b.id,
          simulatorLabel: getSimulatorLabel(b.simulator),
          trainingName: b.trainingName,
          leaseType: b.leaseType,
          startAt: win.startAt,
          endAt: win.endAt,
          daysBefore,
        });

        await writeAuditLog({
          action,
          targetType: "Booking",
          targetId: b.id,
          actorRole: null,
          actorId: null,
          message: daysBefore === 0 ? `Reminder Hari H terkirim ke ${to}` : `Reminder H-${daysBefore} terkirim ke ${to}`,
          metadata: {
            bookingId: b.id,
            daysBefore,
            to,
            scheduleStartAt: win.startAt.toISOString(),
          },
        });
      }

      sent++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      errors.push({ bookingId: b.id, reason });
    }
  }

  return {
    ok: errors.length === 0,
    nowIso: now.toISOString(),
    dryRun,
    scanned: bookings.length,
    candidates,
    sent,
    skippedNoEmail,
    skippedUnverifiedEmail,
    skippedAlreadySent,
    skippedNoSchedule,
    errors,
  };
}
