import { NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import path from "path";
import { readFile } from "fs/promises";

function contentTypeFromExt(ext: string) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

function isSafeFileName(name: string) {
  // no slashes, no traversal, allow basic chars
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!isSafeFileName(name)) return jsonError("Not found", 404);

  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  const relPath = path.join(uploadDir, "landing", name);
  const absPath = path.join(process.cwd(), relPath);

  try {
    const buf = await readFile(absPath);
    return new Response(buf, {
      headers: {
        "Content-Type": contentTypeFromExt(path.extname(name)),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return jsonError("Not found", 404);
  }
}
