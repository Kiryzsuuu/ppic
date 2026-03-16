import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

const UploadSchema = z.object({
  kind: z.enum(["hero", "logo"]).optional(),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = form.get("kind");

    UploadSchema.parse({ kind });

    if (!(file instanceof File)) {
      return jsonError("File wajib diunggah", 400);
    }

    if (!IMAGE_MIME.includes(file.type)) {
      return jsonError("Format gambar harus JPG/PNG/WEBP", 400);
    }

    const uploadDir = process.env.UPLOAD_DIR || "uploads";
    const relDir = path.join(uploadDir, "landing");
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });

    const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const safeBase = crypto.randomBytes(12).toString("hex");
    const name = `${Date.now()}_${safeBase}${ext}`;

    const absPath = path.join(absDir, name);
    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));

    const url = `/api/public/landing-images/${encodeURIComponent(name)}`;
    return jsonOk({ url });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
