import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import path from "path";
import { readFile } from "fs/promises";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { profile: true },
  });

  if (!doc) return jsonError("Dokumen tidak ditemukan", 404);

  const isOwner = session.role === "USER" && doc.profile.userId === session.userId;
  const isStaff = session.role === "ADMIN" || session.role === "FINANCE" || session.role === "INSTRUCTOR";
  if (!isOwner && !isStaff) return jsonError("Forbidden", 403);

  const absPath = path.join(process.cwd(), doc.storagePath);
  const buf = await readFile(absPath);

  return new Response(buf, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
    },
  });
}
