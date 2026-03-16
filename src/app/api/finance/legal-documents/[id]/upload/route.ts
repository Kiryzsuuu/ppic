import { NextRequest } from "next/server";
import path from "path";
import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const ALLOWED_MIME = ["application/pdf"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const legalDoc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!legalDoc) return jsonError("Dokumen legal tidak ditemukan", 404);

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) return jsonError("File wajib diunggah", 400);
  if (!ALLOWED_MIME.includes(file.type)) return jsonError("Format dokumen legal harus PDF", 400);

  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  const absUploadDir = path.join(process.cwd(), uploadDir);
  await mkdir(absUploadDir, { recursive: true });

  const safeBase = crypto.randomBytes(12).toString("hex");
  const storageName = `${Date.now()}_legal_${safeBase}.pdf`;
  const storagePath = path.join(uploadDir, storageName);
  const absPath = path.join(process.cwd(), storagePath);

  const bytes = await file.arrayBuffer();
  await writeFile(absPath, Buffer.from(bytes));

  const updated = await prisma.legalDocument.update({
    where: { id },
    data: {
      fileName: file.name,
      mimeType: file.type,
      storagePath,
    },
  });

  return jsonOk({ legalDoc: updated });
}
