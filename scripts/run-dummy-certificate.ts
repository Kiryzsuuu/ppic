import "dotenv/config";

import crypto from "crypto";
import { PrismaClient, type Prisma } from "@prisma/client";

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name);
}

function requireArg(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing arg: ${name}`);
  return value;
}

function formatIssueNo(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `PPI-CRT-${yyyy}${mm}${dd}-${rand}`;
}

function buildCoolDummyCertificateData(input: {
  bookingId: string;
  recipientName: string;
  licenseNo: string;
  trainingName: string;
  simulatorLabel: string;
  startAtIso: string;
  endAtIso: string;
  instructorName: string;
}) {
  const issuedAt = new Date().toISOString();

  // Keep compatibility with current UI fields
  const base = {
    certificateTitle: "Sertifikat Pelatihan Simulator (Digital)",
    bookingId: input.bookingId,
    recipientName: input.recipientName,
    licenseNo: input.licenseNo,
    trainingName: input.trainingName,
    simulatorLabel: input.simulatorLabel,
    scheduleStartAt: input.startAtIso,
    scheduleEndAt: input.endAtIso,
    result: "PASS",
    notes:
      "Sesi simulasi berhasil diselesaikan dengan baik. Mohon simpan sertifikat ini sebagai bukti pelatihan. QR pada sertifikat dapat diverifikasi oleh petugas.",

    // Extra fields (optional) for richer future rendering
    issueNo: formatIssueNo(),
    issuedAt,
    location: "PPI Curug Training Center",
    instructorName: input.instructorName,
    grade: "A",
    competencies: [
      "Standard Operating Procedures (SOP)",
      "Crew Resource Management (CRM)",
      "Abnormal & Emergency Procedures",
      "Approach & Landing",
    ],
    modules: [
      { code: "SIM-OPS", name: "Simulator Operations", score: 92 },
      { code: "CRM", name: "Crew Resource Management", score: 90 },
      { code: "EMG", name: "Emergency Handling", score: 93 },
    ],
    signatures: {
      instructor: { name: input.instructorName, title: "Instructor" },
      organization: { name: "PPI Curug Simulator Training", title: "Training Provider" },
    },
  } satisfies Record<string, unknown>;

  return base;
}

async function main() {
  const prisma = new PrismaClient();
  const apply = hasFlag("--apply");
  const createIfMissing = hasFlag("--createIfMissing") || hasFlag("--create-if-missing");

  const bookingId = getArgValue("--bookingId");
  const certificateId = getArgValue("--certificateId");
  const emailArg = getArgValue("--email");

  if (!bookingId && !certificateId && !emailArg) {
    console.error("Usage:");
    console.error("  tsx scripts/run-dummy-certificate.ts --certificateId=<id> [--apply]");
    console.error("  tsx scripts/run-dummy-certificate.ts --bookingId=<id> [--apply]");
    console.error("  tsx scripts/run-dummy-certificate.ts --email=<email> [--apply] [--createIfMissing]");
    console.error("Default is DRY RUN. Use --apply to write changes.");
    process.exit(2);
  }

  const email = emailArg ? String(emailArg).trim().toLowerCase() : null;

  const user = email
    ? await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { email: emailArg },
            { profile: { is: { email } } },
            { profile: { is: { email: emailArg } } },
          ],
        },
        include: { profile: true },
      })
    : null;

  const cert = certificateId
    ? await prisma.certificate.findUnique({
        where: { id: certificateId },
        include: {
          booking: { include: { user: { include: { profile: true } }, simulator: true, slot: true } },
          issuedBy: { select: { id: true, username: true, role: true } },
        },
      })
    : null;

  const booking = bookingId
    ? await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: { include: { profile: true } },
          simulator: true,
          slot: true,
          certificate: true,
        },
      })
    : cert?.booking ?? (user
        ? await prisma.booking.findFirst({
            where: {
              userId: user.id,
              slot: { isNot: null },
            },
            include: {
              user: { include: { profile: true } },
              simulator: true,
              slot: true,
              certificate: true,
            },
            orderBy: { requestedAt: "desc" },
          })
        : null);

  if (!booking) {
    throw new Error("Booking/Certificate tidak ditemukan");
  }

  if (!booking.slot) {
    throw new Error("Booking belum punya slot. Dummy sertifikat butuh jadwal slot.");
  }

  const instructorName = cert?.issuedBy?.username || "Instruktur PPI";

  const recipientName = booking.user.profile?.fullName || booking.user.username;
  const licenseNo = booking.user.profile?.licenseNo || "PPL-000000";

  const simulatorLabel = `${booking.simulator.category} ${booking.simulator.name}`;
  const data = buildCoolDummyCertificateData({
    bookingId: booking.id,
    recipientName,
    licenseNo,
    trainingName: booking.trainingName,
    simulatorLabel,
    startAtIso: booking.slot.startAt.toISOString(),
    endAtIso: booking.slot.endAt.toISOString(),
    instructorName,
  });

  let targetCertificateId = cert?.id || booking.certificate?.id || null;
  if (!targetCertificateId) {
    if (!createIfMissing) {
      console.log({ ok: false, reason: "Certificate belum ada. Buat sertifikat dulu via UI/endpoint instructor/admin atau pakai --createIfMissing." });
      await prisma.$disconnect();
      process.exit(1);
    }

    const issuer = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "INSTRUCTOR", "FINANCE"] } },
      select: { id: true, username: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (!issuer) {
      throw new Error("Tidak ada user staff (ADMIN/INSTRUCTOR/FINANCE) untuk issuedById");
    }

    if (apply) {
      const created = await prisma.certificate.create({
        data: {
          bookingId: booking.id,
          qrValue: `PPI-CRT-${booking.id}-${crypto.randomBytes(6).toString("hex")}`,
          issuedById: issuer.id,
          data: data as Prisma.InputJsonValue,
        },
      });
      targetCertificateId = created.id;
      console.log({ ok: true, createdCertificate: true, targetCertificateId, issuedBy: issuer });
    } else {
      console.log({
        ok: true,
        createdCertificate: false,
        hint: "Certificate belum ada. Jalankan dengan --apply (dan opsional --createIfMissing) untuk membuat + isi data dummy.",
      });
      await prisma.$disconnect();
      return;
    }
  }

  console.log({ dryRun: !apply, targetCertificateId, bookingId: booking.id, dataPreview: data });

  if (apply) {
    await prisma.certificate.update({
      where: { id: targetCertificateId },
      data: { data: data as Prisma.InputJsonValue },
    });
    console.log({ ok: true, updated: true, targetCertificateId });
  } else {
    console.log({ ok: true, updated: false, hint: "Tambahkan --apply untuk menulis ke DB" });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
