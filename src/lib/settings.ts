import { prisma } from "@/lib/prisma";

export async function getSettingJson<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  if (!row) return fallback;
  return row.value as T;
}

export async function setSettingJson(key: string, value: unknown) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as any },
    update: { value: value as any },
  });
}
