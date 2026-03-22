import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  const { searchParams } = new URL(req.url);
  const takeRaw = Number(searchParams.get("take") ?? "500");
  const take = Math.max(1, Math.min(5000, Math.trunc(takeRaw)));

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { username: true } } },
  });

  const header = [
    "createdAt",
    "action",
    "actorId",
    "actorUsername",
    "actorRole",
    "targetType",
    "targetId",
    "ip",
    "deviceId",
    "userAgent",
    "message",
    "metadata",
  ].join(",");

  const rows = logs.map((l) => {
    const meta = l.metadata ? JSON.stringify(l.metadata) : "";
    const deviceId =
      typeof l.metadata === "object" && l.metadata && !Array.isArray(l.metadata)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          String((l.metadata as any).deviceId ?? "")
        : "";
    return [
      csvCell(l.createdAt.toISOString()),
      csvCell(l.action),
      csvCell(l.actorId),
      csvCell(l.actor?.username ?? ""),
      csvCell(l.actorRole ?? ""),
      csvCell(l.targetType ?? ""),
      csvCell(l.targetId ?? ""),
      csvCell(l.ip ?? ""),
      csvCell(deviceId),
      csvCell(l.userAgent ?? ""),
      csvCell(l.message ?? ""),
      csvCell(meta),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours(),
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit_logs_${stamp}.csv"`,
    },
  });
}
