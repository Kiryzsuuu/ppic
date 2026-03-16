import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type NotificationInput = {
  userId: string;
  title: string;
  body: string;
  kind?: string;
  metadata?: unknown;
};

export async function createNotification(input: NotificationInput) {
  return await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      kind: input.kind ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
    },
  });
}
