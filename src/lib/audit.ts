import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditLogInput = {
  actorId?: string | null;
  actorRole?: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR" | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  message?: string | null;
  metadata?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      message: input.message ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  return realIp ? realIp.trim() : null;
}
