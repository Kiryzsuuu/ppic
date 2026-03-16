import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { id } = await ctx.params;
  if (id === session.userId) return jsonError("Tidak bisa menghapus akun sendiri", 400);

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, username: true } });
  if (!existing) return jsonError("User tidak ditemukan", 404);

  const ip = getClientIpFromHeaders(req.headers);
  const userAgent = req.headers.get("user-agent");

  try {
    const [
      bookingsCount,
      createdSlotsCount,
      validatedPaymentsCount,
      issuedLegalDocsCount,
      logbookEntriesCount,
      issuedCertificatesCount,
    ] = await prisma.$transaction([
      prisma.booking.count({ where: { userId: id } }),
      prisma.scheduleSlot.count({ where: { createdByAdminId: id } }),
      prisma.payment.count({ where: { validatedById: id } }),
      prisma.legalDocument.count({ where: { issuedById: id } }),
      prisma.logbookEntry.count({ where: { instructorId: id } }),
      prisma.certificate.count({ where: { issuedById: id } }),
    ]);

    const blockers: Array<{ label: string; count: number }> = [
      { label: "Booking", count: bookingsCount },
      { label: "Slot dibuat", count: createdSlotsCount },
      { label: "Validasi pembayaran", count: validatedPaymentsCount },
      { label: "Legal document diterbitkan", count: issuedLegalDocsCount },
      { label: "Logbook (instruktur)", count: logbookEntriesCount },
      { label: "Sertifikat diterbitkan", count: issuedCertificatesCount },
    ].filter((b) => b.count > 0);

    if (blockers.length) {
      const detail = blockers.map((b) => `${b.label}=${b.count}`).join(", ");
      return jsonError(`User tidak bisa dihapus karena masih punya data terkait: ${detail}. Pindahkan/hapus data tersebut dulu.`, 409);
    }

    await prisma.$transaction(async (tx) => {
      // Lepas referensi optional agar audit/history tetap konsisten
      await tx.profile.updateMany({ where: { verifiedById: id }, data: { verifiedById: null } });
      await tx.document.updateMany({ where: { verifiedById: id }, data: { verifiedById: null } });

      // Hapus data yang memang hanya milik user
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.emailVerification.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.passwordResetOtp.deleteMany({ where: { userId: id } });

      // AuditLog actorId bersifat optional -> null-kan agar log tetap ada
      await tx.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null, actorRole: null } });

      const profile = await tx.profile.findUnique({ where: { userId: id }, select: { id: true } });
      if (profile) {
        await tx.document.deleteMany({ where: { profileId: profile.id } });
        await tx.profile.delete({ where: { id: profile.id } });
      }

      await tx.user.delete({ where: { id } });
    });

    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.user.deleted",
        targetType: "User",
        targetId: id,
        ip,
        userAgent,
      });
    } catch {
      // ignore
    }
    return jsonOk({});
  } catch (e) {
    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "admin.user.delete_failed",
        targetType: "User",
        targetId: id,
        ip,
        userAgent,
        metadata: {
          error: e instanceof Error ? e.message : String(e),
        },
      });
    } catch {
      // ignore
    }
    return jsonError("Gagal menghapus user", 500);
  }
}
