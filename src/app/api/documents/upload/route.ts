import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";

const UploadSchema = z.object({
  type: z.enum(["LICENSE", "MEDICAL", "ID", "LOGBOOK", "PHOTO", "CV"]),
});

const PDF_MIME = "application/pdf";
const IMAGE_MIME = ["image/jpeg", "image/png"];

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["USER", "ADMIN", "FINANCE", "INSTRUCTOR"]);
  if (!session) return response;

  try {
    const form = await req.formData();
    const type = form.get("type");
    const file = form.get("file");

    const parsed = UploadSchema.parse({ type });

    if (!(file instanceof File)) {
      return jsonError("File wajib diunggah", 400);
    }

    const isPdf = file.type === PDF_MIME;
    const isImage = IMAGE_MIME.includes(file.type);

    const typeMimeOk =
      parsed.type === "PHOTO" ? isImage : parsed.type === "LICENSE" || parsed.type === "MEDICAL" || parsed.type === "ID" || parsed.type === "LOGBOOK" || parsed.type === "CV" ? isPdf : false;

    if (!typeMimeOk) {
      if (parsed.type === "PHOTO") return jsonError("Format PHOTO harus JPG/PNG", 400);
      return jsonError("Format file harus PDF", 400);
    }

    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    if (!profile) return jsonError("Profil tidak ditemukan", 404);

    const uploadDir = process.env.UPLOAD_DIR || "uploads";
    const absUploadDir = path.join(process.cwd(), uploadDir);
    await mkdir(absUploadDir, { recursive: true });

    const ext = isPdf ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
    const safeBase = crypto.randomBytes(12).toString("hex");
    const storageName = `${Date.now()}_${safeBase}${ext}`;
    const storagePath = path.join(uploadDir, storageName);
    const absPath = path.join(process.cwd(), storagePath);

    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));

    const doc = await prisma.document.create({
      data: {
        profileId: profile.id,
        type: parsed.type,
        fileName: file.name,
        mimeType: file.type,
        storagePath,
        status: parsed.type === "PHOTO" ? "APPROVED" : "PENDING",
      },
    });

    return jsonOk({ document: doc });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
