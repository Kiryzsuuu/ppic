import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const CreateBookingSchema = z.object({
  simulatorId: z.string().min(1),
  bookingType: z.enum(["LEASE", "TRAINING"]).default("LEASE"),
  leaseType: z.enum(["WET", "DRY"]),
  trainingCode: z.enum(["PPC", "INITIAL_ATPL", "TYPE_RATING", "DIFFERENCES", "OTHER"]),
  trainingName: z.string().min(2).max(120),
  deviceType: z.enum(["FFS", "FTD"]).optional(),
  personCount: z.number().int().min(1).max(2).optional(),
  paymentMethod: z.enum(["QRIS", "TRANSFER"]).optional(),
  preferredSlotId: z.string().min(1).optional(),
  institutionName: z.string().max(120).optional(),
  requestedStartAt: z.string().datetime().optional(),
  requestedEndAt: z.string().datetime().optional(),
}).superRefine((val, ctx) => {
  if (val.leaseType === "WET") {
    if (!["PPC", "TYPE_RATING", "DIFFERENCES", "OTHER"].includes(val.trainingCode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TrainingCode untuk Wet harus PPC/TYPE_RATING/DIFFERENCES/OTHER" });
    }
    if (val.personCount !== 1 && val.personCount !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "personCount wajib (1 atau 2) untuk Wet Leased" });
    }

    if (!val.requestedStartAt || !val.requestedEndAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "requestedStartAt dan requestedEndAt wajib untuk Wet Leased" });
    } else {
      const start = new Date(val.requestedStartAt);
      const end = new Date(val.requestedEndAt);
      if (!Number.isFinite(start.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Format requestedStartAt tidak valid" });
      } else if (!Number.isFinite(end.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Format requestedEndAt tidak valid" });
      } else if (end.getTime() <= start.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Jam selesai harus setelah jam mulai" });
      }
    }
  }

  if (val.leaseType === "DRY") {
    if (!val.deviceType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deviceType wajib untuk Dry Leased" });
    }

    if (val.preferredSlotId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dry Leased tidak menggunakan slot admin" });
    }

    if (!val.requestedStartAt || !val.requestedEndAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Jadwal (requestedStartAt/requestedEndAt) wajib untuk Dry Leased" });
    } else {
      const start = new Date(val.requestedStartAt);
      const end = new Date(val.requestedEndAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Format jadwal tidak valid" });
      } else if (end.getTime() <= start.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Jam selesai harus setelah jam mulai" });
      }
    }
  }
});

export async function GET() {
  const { session, response } = await requireRole(["USER"]);
  if (!session) return response;

  const bookings = await prisma.booking.findMany({
    where: { userId: session.userId },
    include: { simulator: true, payment: true, slot: true, certificate: true },
    orderBy: { requestedAt: "desc" },
  });

  return jsonOk({ bookings });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["USER"]);
  if (!session) return response;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerifiedAt: true },
    });

    if (!user?.emailVerifiedAt) {
      return jsonError("Email belum terverifikasi. Silakan verifikasi OTP terlebih dahulu.", 403);
    }

    const body = await req.json();
    const input = CreateBookingSchema.parse(body);

    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    if (!profile) return jsonError("Profil tidak ditemukan", 404);

    const simulator = await prisma.simulator.findUnique({ where: { id: input.simulatorId } });
    if (!simulator) return jsonError("Simulator tidak ditemukan", 404);

    // Differences is only allowed for Boeing (WET flow).
    if (
      input.leaseType === "WET" &&
      simulator.category !== "BOEING" &&
      input.trainingCode === "OTHER" &&
      input.trainingName.trim().toLowerCase() === "differences"
    ) {
      return jsonError("Differences hanya tersedia untuk Boeing.", 400);
    }

    let trainingCode = input.trainingCode;
    let trainingName = input.trainingName;
    let preferredSlotId = input.preferredSlotId;

    // For DRY, we normalize training label to avoid mismatch.
    if (input.leaseType === "DRY") {
      trainingCode = "OTHER";
      trainingName = `Dry Leased (${input.deviceType})`;
    }

    // For WET, validate slot time and handle auto-create or verify existing slot
    if (input.leaseType === "WET" && input.requestedStartAt && input.requestedEndAt) {
      const startTime = new Date(input.requestedStartAt);
      const endTime = new Date(input.requestedEndAt);

      // Validate 1-hour duration and operating hours
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      if (Math.abs(durationHours - 1) > 0.01) {
        return jsonError("WET Leased harus 1 jam. Silakan pilih jam yang sesuai.", 400);
      }

      // Get minutes in WIB timezone
      const wibFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = wibFormatter.formatToParts(startTime);
      const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
      const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
      const startMinutes = parseInt(hh) * 60 + parseInt(mm);

      // Validate operating hours: 07:30-11:30 and 11:45-15:45
      const isValidMorning = startMinutes >= 7 * 60 + 30 && startMinutes + 60 <= 11 * 60 + 30;
      const isValidAfternoon = startMinutes >= 11 * 60 + 45 && startMinutes + 60 <= 15 * 60 + 45;
      if (!isValidMorning && !isValidAfternoon) {
        return jsonError("Jam harus dalam operasional: 07:30-11:30 atau 11:45-15:45 WIB.", 400);
      }

      // Check for conflicts with existing BOOKED/LOCKED slots
      const conflictSlot = await prisma.scheduleSlot.findFirst({
        where: {
          simulatorId: input.simulatorId,
          status: { in: ["BOOKED", "LOCKED"] },
          startAt: { lt: endTime },
          endAt: { gt: startTime },
        },
      });

      if (conflictSlot) {
        return jsonError("Jam tersebut sudah di-booking atau di-lock. Silakan pilih jam lain.", 409);
      }

      // If preferredSlotId provided, verify it exists and is AVAILABLE
      if (preferredSlotId) {
        const preferredSlot = await prisma.scheduleSlot.findUnique({
          where: { id: preferredSlotId },
        });
        if (!preferredSlot) {
          return jsonError("Slot tidak ditemukan.", 404);
        }
        if (preferredSlot.status !== "AVAILABLE") {
          return jsonError("Slot sudah di-booking. Silakan pilih jam lain.", 409);
        }
      } else {
        // Auto-create slot LOCKED for virtual slot
        const newSlot = await prisma.scheduleSlot.create({
          data: {
            simulatorId: input.simulatorId,
            startAt: startTime,
            endAt: endTime,
            status: "LOCKED",
            createdByAdminId: null,
          },
        });
        preferredSlotId = newSlot.id;
      }
    }

    const booking = await prisma.booking.create({
      data: {
        userId: session.userId,
        simulatorId: input.simulatorId,
        bookingType: input.bookingType ?? "LEASE",
        leaseType: input.leaseType,
        trainingCode,
        trainingName,
        deviceType: input.deviceType,
        personCount: input.personCount ?? 1,
        paymentMethod: input.paymentMethod ?? "QRIS",
        preferredSlotId,
        institutionName: input.institutionName ?? null,
        requestedStartAt: input.requestedStartAt ? new Date(input.requestedStartAt) : undefined,
        requestedEndAt: input.requestedEndAt ? new Date(input.requestedEndAt) : undefined,
        status: "DRAFT",
      },
      include: { simulator: true },
    });

    return jsonOk({ booking });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
