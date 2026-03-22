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
  deviceId?: string | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  const deviceId = input.deviceId ?? null;
  const shouldMergeDeviceId =
    Boolean(deviceId) &&
    (input.metadata == null || (typeof input.metadata === "object" && !Array.isArray(input.metadata)));

  const metadata = shouldMergeDeviceId
    ? { ...(input.metadata as Record<string, unknown> | null | undefined), deviceId }
    : input.metadata;

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      message: input.message ?? null,
      metadata: (metadata ?? null) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rest.join("=").trim();
    if (!value) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getDeviceIdFromHeaders(headers: Headers, opts?: { cookieName?: string }): string | null {
  const headerValue = headers.get("x-device-id");
  if (headerValue && headerValue.trim()) return headerValue.trim();

  const cookieName = opts?.cookieName ?? "ppic_device_id";
  const cookies = parseCookieHeader(headers.get("cookie"));
  const value = cookies[cookieName];
  return value && value.trim() ? value.trim() : null;
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  return realIp ? realIp.trim() : null;
}
