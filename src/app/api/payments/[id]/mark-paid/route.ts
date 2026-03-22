import { NextRequest } from "next/server";
import path from "path";
import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { sendPaymentSubmittedEmail } from "@/lib/emails";
import { getClientIpFromHeaders, getDeviceIdFromHeaders, writeAuditLog } from "@/lib/audit";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["USER"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { booking: true },
  });

  if (!payment) return jsonError("Payment tidak ditemukan", 404);
  if (payment.booking.userId !== session.userId) return jsonError("Forbidden", 403);
  if (payment.status !== "UNPAID") return jsonError("Pembayaran sudah diproses", 400);

  const form = await req.formData();
  const file = form.get("file");

  let proof: { proofFileName?: string; proofMimeType?: string; proofStoragePath?: string } = {};

  if (file instanceof File) {
    if (!ALLOWED_MIME.includes(file.type)) return jsonError("Format bukti bayar harus PDF/JPG/PNG", 400);

    const uploadDir = process.env.UPLOAD_DIR || "uploads";
    const absUploadDir = path.join(process.cwd(), uploadDir);
    await mkdir(absUploadDir, { recursive: true });

    const ext = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
    const safeBase = crypto.randomBytes(12).toString("hex");
    const storageName = `${Date.now()}_payment_${safeBase}${ext}`;
    const storagePath = path.join(uploadDir, storageName);
    const absPath = path.join(process.cwd(), storagePath);

    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));

    proof = { proofFileName: file.name, proofMimeType: file.type, proofStoragePath: storagePath };
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const p = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), ...proof },
    });

    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "PAYMENT_VALIDATION" },
    });

    return p;
  });

  const bookingFull = await prisma.booking.findUnique({
    where: { id: payment.bookingId },
    include: { user: { select: { email: true, profile: { select: { email: true, fullName: true } } } } },
  });
  const email = (bookingFull?.user.email ?? bookingFull?.user.profile?.email)?.trim().toLowerCase();
  const fullName = bookingFull?.user.profile?.fullName ?? null;

  const ip = getClientIpFromHeaders(req.headers);
  const deviceId = getDeviceIdFromHeaders(req.headers);
  const userAgent = req.headers.get("user-agent");
  try {
    await writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "payment.submitted",
      targetType: "Payment",
      targetId: updated.id,
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
      kind: "PAYMENT",
      title: "Bukti pembayaran diterima",
      body: "Bukti pembayaran Anda sudah diterima dan menunggu validasi.",
      metadata: { bookingId: payment.bookingId, paymentId: updated.id },
    });
  } catch {
    // ignore
  }

  if (email) {
    try {
      await sendPaymentSubmittedEmail({ to: email, name: fullName, bookingId: payment.bookingId });
    } catch {
      // ignore
    }
  }

  return jsonOk({ payment: updated });
}
