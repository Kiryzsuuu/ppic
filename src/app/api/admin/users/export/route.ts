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
  const takeRaw = Number(searchParams.get("take") ?? "2000");
  const take = Math.max(1, Math.min(5000, Math.trunc(takeRaw)));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      profile: { select: { fullName: true, email: true, status: true } },
    },
  });

  const header = [
    "id",
    "username",
    "fullName",
    "email",
    "role",
    "emailVerifiedAt",
    "profileStatus",
    "createdAt",
    "lastLoginAt",
    "lastLoginIp",
  ].join(",");

  const rows = users.map((u) => {
    const effectiveEmail = u.email ?? u.profile?.email ?? "";
    return [
      csvCell(u.id),
      csvCell(u.username),
      csvCell(u.profile?.fullName ?? ""),
      csvCell(effectiveEmail),
      csvCell(u.role),
      csvCell(u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : ""),
      csvCell(u.profile?.status ?? ""),
      csvCell(u.createdAt.toISOString()),
      csvCell(u.lastLoginAt ? u.lastLoginAt.toISOString() : ""),
      csvCell(u.lastLoginIp ?? ""),
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
      "content-disposition": `attachment; filename="users_${stamp}.csv"`,
    },
  });
}
