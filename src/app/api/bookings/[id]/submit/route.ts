import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { sendBookingCreatedEmail } from "@/lib/emails";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

function parseEmailList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["USER"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return jsonError("Booking tidak ditemukan", 404);
  if (booking.userId !== session.userId) return jsonError("Forbidden", 403);

  if (booking.status !== "DRAFT") return jsonError("Booking sudah disubmit", 400);

  const profile = (await prisma.profile.findUnique({
    where: { userId: session.userId },
    include: { documents: true },
  })) as Prisma.ProfileGetPayload<{ include: { documents: true } }> | null;
  if (!profile) return jsonError("Profil tidak ditemukan", 404);

  if (booking.leaseType === "WET") {
    const bypassEmails = parseEmailList(process.env.DOCS_BYPASS_EMAILS);
    const userEmailRow = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const normalizedEmail = (userEmailRow?.email ?? profile.email ?? "").trim().toLowerCase();

    // Security note:
    // Bypass is ALWAYS explicit and controlled by DOCS_BYPASS_EMAILS allowlist.
    // This avoids accidentally allowing document-less submissions in production.
    const isBypassUser = Boolean(normalizedEmail && bypassEmails.includes(normalizedEmail));

    const requiredTypes = ["LICENSE", "MEDICAL", "ID"] as const;
    const missing = requiredTypes.filter((t) => !profile.documents.some((d) => String(d.type) === t));
    if (!isBypassUser && missing.length > 0) {
      return jsonError(`Dokumen wajib belum lengkap: ${missing.join(", ")}`, 400);
    }
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "WAIT_ADMIN_VERIFICATION" },
  });

  const bookingFull = await prisma.booking.findUnique({
    where: { id },
    include: {
      simulator: true,
      user: { select: { email: true, profile: { select: { email: true, fullName: true } } } },
    },
  });

  const email = (bookingFull?.user.email ?? bookingFull?.user.profile?.email)?.trim().toLowerCase();
  const fullName = bookingFull?.user.profile?.fullName ?? null;
  const simulatorLabel = bookingFull?.simulator ? `${bookingFull.simulator.category} ${bookingFull.simulator.name}` : "-";

  const ip = getClientIpFromHeaders(_req.headers);
  const deviceId = getDeviceIdFromHeaders(_req.headers);
  const userAgent = _req.headers.get("user-agent");
  try {
    await writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "booking.submitted",
      targetType: "Booking",
      targetId: id,
      ip,
      deviceId,
      userAgent,
    });
  } catch {
    // ignore
  }

  try {
    await createNotification({
      userId: session.userId,
      kind: "BOOKING",
      title: "Booking disubmit",
      body: "Booking Anda telah disubmit dan menunggu verifikasi admin.",
      metadata: { bookingId: id },
    });
  } catch {
    // ignore
  }

  if (email && bookingFull) {
    try {
      await sendBookingCreatedEmail({
        to: email,
        name: fullName,
        bookingId: id,
        simulatorLabel,
        trainingName: bookingFull.trainingName,
        leaseType: bookingFull.leaseType,
      });
    } catch {
      // ignore
    }
  }

  return jsonOk({ booking: updated });
}
