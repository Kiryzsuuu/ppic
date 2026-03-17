import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

const TemplateSchema = z
  .object({
    certificateTitle: z.string().optional(),
    certificateSubtitle: z.string().optional(),
    issuedPlace: z.string().optional(),
  })
  .strict();

function getKey(userId: string) {
  return `certificateTemplate:INSTRUCTOR:${userId}`;
}

export async function GET(_req: NextRequest) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const setting = await prisma.appSetting.findUnique({
    where: { key: getKey(session.userId) },
  });

  const value = (setting?.value ?? null) as unknown;
  const parsed = TemplateSchema.safeParse(value);
  const template = parsed.success ? parsed.data : null;

  return jsonOk({ template });
}

export async function PUT(req: NextRequest) {
  const { session, response } = await requireRole(["INSTRUCTOR"]);
  if (!session) return response;

  const body = await req.json().catch(() => null);
  const parsed = TemplateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Body tidak valid", 400, parsed.error.flatten());

  const key = getKey(session.userId);
  const value = parsed.data as Prisma.InputJsonValue;

  const setting = await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return jsonOk({ template: setting.value });
}
