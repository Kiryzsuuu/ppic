import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function dropIndexIfExists(prisma: PrismaClient, collection: string, indexName: string) {
  try {
    await prisma.$runCommandRaw({
      dropIndexes: collection,
      index: indexName,
    });
    console.log(`[index] dropped ${collection}.${indexName}`);
  } catch (e: any) {
    // Mongo error code 27 = IndexNotFound
    const code = e?.code;
    if (code === 27) {
      console.log(`[index] missing (ok) ${collection}.${indexName}`);
      return;
    }
    // Prisma may wrap errors; keep it visible.
    console.warn(`[index] failed to drop ${collection}.${indexName}`);
    throw e;
  }
}

async function createSparseUniqueIndex(prisma: PrismaClient, collection: string, indexName: string, key: Record<string, 1 | -1>) {
  await prisma.$runCommandRaw({
    createIndexes: collection,
    indexes: [
      {
        key,
        name: indexName,
        unique: true,
        sparse: true,
      },
    ],
  });
  console.log(`[index] created sparse unique ${collection}.${indexName}`);
}

async function main() {
  requireEnv("DATABASE_URL");

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    // Prisma MongoDB connector creates non-sparse unique indexes for optional @unique fields.
    // That prevents inserting multiple documents with null values.
    // Fix by recreating those indexes as sparse unique.

    // User.email String? @unique
    await dropIndexIfExists(prisma, "User", "User_email_key");
    await createSparseUniqueIndex(prisma, "User", "User_email_key", { email: 1 });

    // ScheduleSlot.bookingId String? @unique
    await dropIndexIfExists(prisma, "ScheduleSlot", "ScheduleSlot_bookingId_key");
    await createSparseUniqueIndex(prisma, "ScheduleSlot", "ScheduleSlot_bookingId_key", { bookingId: 1 });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[index] failed", e);
  process.exit(1);
});
