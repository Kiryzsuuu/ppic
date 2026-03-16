import { NextRequest } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole(["FINANCE"]);
  if (!session) return response;

  const { id } = await ctx.params;

  const legalDoc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!legalDoc) return jsonError("Dokumen legal tidak ditemukan", 404);

  if (!legalDoc.storagePath) return jsonError("File dokumen legal belum diunggah", 404);

  const absPath = path.join(process.cwd(), legalDoc.storagePath);
  let buf: Buffer;
  try {
    buf = await readFile(absPath);
  } catch {
    return jsonError("File dokumen legal tidak ditemukan", 404);
  }

  const fileName = legalDoc.fileName || `legal-${legalDoc.id}.pdf`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": legalDoc.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
