import "dotenv/config";

import { PrismaClient as MongoClient } from "@prisma/client";
// Generated from prisma/schema.sqlite.prisma
import { PrismaClient as SqliteClient } from "../prisma/generated/sqlite";

const BATCH_SIZE = 500;

type ModelName =
  | "user"
  | "profile"
  | "document"
  | "simulator"
  | "scheduleSlot"
  | "booking"
  | "payment"
  | "legalDocument"
  | "logbookEntry"
  | "certificate"
  | "auditLog"
  | "notification"
  | "emailVerification"
  | "passwordResetToken"
  | "passwordResetOtp";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function stripNullish<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function deleteIfBlankString(obj: Record<string, unknown>, key: string) {
  const v = obj[key];
  if (typeof v === "string" && v.trim() === "") {
    delete obj[key];
  }
}

function isPrismaUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as any).code === "P2002"
  );
}

async function createManyWithFallback<T extends Record<string, unknown>>(opts: {
  name: ModelName;
  rows: T[];
  createMany: (data: T[]) => Promise<{ count: number }>;
  createOne: (data: T) => Promise<unknown>;
  normalize?: (row: T) => T;
}): Promise<number> {
  const data = opts.rows.map((r) => {
    const base = stripNullish(r);
    return opts.normalize ? opts.normalize(base) : base;
  });
  try {
    const res = await opts.createMany(data);
    return res.count;
  } catch (e) {
    console.warn(`[migrate] ${opts.name}: createMany failed; falling back to per-row inserts`);
    // Uncomment for deep diagnostics when needed:
    // console.warn(e);

    let inserted = 0;
    let skippedUnique = 0;
    for (const row of data) {
      try {
        await opts.createOne(row);
        inserted += 1;
      } catch (err) {
        if (isPrismaUniqueConstraintError(err)) {
          skippedUnique += 1;
          if (skippedUnique <= 3) {
            const id = (row as any).id;
            const meta = (err as any)?.meta;
            console.warn(
              `[migrate] ${opts.name}: skipped duplicate (id=${id ?? "?"}) meta=${meta ? JSON.stringify(meta) : "?"}`,
            );
          }
          continue;
        }
        throw err;
      }
    }
    return inserted;
  }
}

async function migrateInBatches<T>(opts: {
  name: ModelName;
  count: () => Promise<number>;
  fetch: (skip: number, take: number) => Promise<T[]>;
  insertMany: (rows: T[]) => Promise<number>;
}) {
  const total = await opts.count();
  console.log(`[migrate] ${opts.name}: ${total} rows`);

  let migrated = 0;
  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const rows = await opts.fetch(skip, BATCH_SIZE);
    if (!rows.length) break;
    const inserted = await opts.insertMany(rows);
    migrated += inserted;
    console.log(
      `[migrate] ${opts.name}: read ${Math.min(skip + rows.length, total)}/${total}; inserted ${migrated}`,
    );
  }

  console.log(`[migrate] ${opts.name}: done (${migrated}/${total})`);
}

async function main() {
  // Validate envs early
  requireEnv("DATABASE_URL");
  requireEnv("SQLITE_DATABASE_URL");

  const sqlite = new SqliteClient();
  const mongo = new MongoClient();

  console.log("[migrate] connecting...");
  await sqlite.$connect();
  await mongo.$connect();
  console.log("[migrate] connected");

  // IMPORTANT: order keeps references available for lookups (even though Mongo doesn't enforce FKs)
  await migrateInBatches({
    name: "user",
    count: () => sqlite.user.count(),
    fetch: (skip, take) =>
      sqlite.user.findMany({
        skip,
        take,
        orderBy: { createdAt: "asc" },
      }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "user",
        rows: rows as any,
        createMany: (data) => mongo.user.createMany({ data: data as any }),
        createOne: (data) => mongo.user.create({ data: data as any }),
        normalize: (row) => {
          const obj = row as any as Record<string, unknown>;
          deleteIfBlankString(obj, "email");
          return row;
        },
      });
    },
  });

  await migrateInBatches({
    name: "profile",
    count: () => sqlite.profile.count(),
    fetch: (skip, take) => sqlite.profile.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "profile",
        rows: rows as any,
        createMany: (data) => mongo.profile.createMany({ data: data as any }),
        createOne: (data) => mongo.profile.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "simulator",
    count: () => sqlite.simulator.count(),
    fetch: (skip, take) => sqlite.simulator.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "simulator",
        rows: rows as any,
        createMany: (data) => mongo.simulator.createMany({ data: data as any }),
        createOne: (data) => mongo.simulator.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "booking",
    count: () => sqlite.booking.count(),
    fetch: (skip, take) => sqlite.booking.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "booking",
        rows: rows as any,
        createMany: (data) => mongo.booking.createMany({ data: data as any }),
        createOne: (data) => mongo.booking.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "scheduleSlot",
    count: () => sqlite.scheduleSlot.count(),
    fetch: (skip, take) => sqlite.scheduleSlot.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "scheduleSlot",
        rows: rows as any,
        createMany: (data) => mongo.scheduleSlot.createMany({ data: data as any }),
        createOne: (data) => mongo.scheduleSlot.create({ data: data as any }),
        normalize: (row) => {
          const obj = row as any as Record<string, unknown>;
          deleteIfBlankString(obj, "bookingId");
          return row;
        },
      });
    },
  });

  await migrateInBatches({
    name: "document",
    count: () => sqlite.document.count(),
    fetch: (skip, take) => sqlite.document.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "document",
        rows: rows as any,
        createMany: (data) => mongo.document.createMany({ data: data as any }),
        createOne: (data) => mongo.document.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "payment",
    count: () => sqlite.payment.count(),
    fetch: (skip, take) => sqlite.payment.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "payment",
        rows: rows as any,
        createMany: (data) => mongo.payment.createMany({ data: data as any }),
        createOne: (data) => mongo.payment.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "legalDocument",
    count: () => sqlite.legalDocument.count(),
    fetch: (skip, take) => sqlite.legalDocument.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "legalDocument",
        rows: rows as any,
        createMany: (data) => mongo.legalDocument.createMany({ data: data as any }),
        createOne: (data) => mongo.legalDocument.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "logbookEntry",
    count: () => sqlite.logbookEntry.count(),
    fetch: (skip, take) => sqlite.logbookEntry.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "logbookEntry",
        rows: rows as any,
        createMany: (data) => mongo.logbookEntry.createMany({ data: data as any }),
        createOne: (data) => mongo.logbookEntry.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "certificate",
    count: () => sqlite.certificate.count(),
    fetch: (skip, take) => sqlite.certificate.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "certificate",
        rows: rows as any,
        createMany: (data) => mongo.certificate.createMany({ data: data as any }),
        createOne: (data) => mongo.certificate.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "notification",
    count: () => sqlite.notification.count(),
    fetch: (skip, take) => sqlite.notification.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "notification",
        rows: rows as any,
        createMany: (data) => mongo.notification.createMany({ data: data as any }),
        createOne: (data) => mongo.notification.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "auditLog",
    count: () => sqlite.auditLog.count(),
    fetch: (skip, take) => sqlite.auditLog.findMany({ skip, take, orderBy: { createdAt: "asc" } }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "auditLog",
        rows: rows as any,
        createMany: (data) => mongo.auditLog.createMany({ data: data as any }),
        createOne: (data) => mongo.auditLog.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "emailVerification",
    count: () => sqlite.emailVerification.count(),
    fetch: (skip, take) => sqlite.emailVerification.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "emailVerification",
        rows: rows as any,
        createMany: (data) => mongo.emailVerification.createMany({ data: data as any }),
        createOne: (data) => mongo.emailVerification.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "passwordResetToken",
    count: () => sqlite.passwordResetToken.count(),
    fetch: (skip, take) => sqlite.passwordResetToken.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "passwordResetToken",
        rows: rows as any,
        createMany: (data) => mongo.passwordResetToken.createMany({ data: data as any }),
        createOne: (data) => mongo.passwordResetToken.create({ data: data as any }),
      });
    },
  });

  await migrateInBatches({
    name: "passwordResetOtp",
    count: () => sqlite.passwordResetOtp.count(),
    fetch: (skip, take) => sqlite.passwordResetOtp.findMany({ skip, take }),
    insertMany: async (rows) => {
      return createManyWithFallback({
        name: "passwordResetOtp",
        rows: rows as any,
        createMany: (data) => mongo.passwordResetOtp.createMany({ data: data as any }),
        createOne: (data) => mongo.passwordResetOtp.create({ data: data as any }),
      });
    },
  });

  console.log("[migrate] done");

  await sqlite.$disconnect();
  await mongo.$disconnect();
}

main().catch((e) => {
  console.error("[migrate] failed", e);
  process.exit(1);
});
