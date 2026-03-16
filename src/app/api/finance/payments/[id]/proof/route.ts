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

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return jsonError("Payment tidak ditemukan", 404);

  if (!payment.proofStoragePath) return jsonError("Bukti bayar belum diunggah", 404);

  const absPath = path.join(process.cwd(), payment.proofStoragePath);
  let buf: Buffer;
  try {
    buf = await readFile(absPath);
  } catch {
    return jsonError("File bukti bayar tidak ditemukan", 404);
  }

  const fileName = payment.proofFileName || "bukti-bayar";

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": payment.proofMimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
