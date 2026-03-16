import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

async function main() {
  const q = getArgValue("--q") ?? "";
  if (!q.trim()) {
    console.error("Usage: tsx scripts/find-simulators.ts --q=A320");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const query = q.trim();

    let sims:
      | Array<{ id: string; name: string; category: any; createdAt: Date }>
      | undefined;

    try {
      sims = await prisma.simulator.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: { id: true, name: true, category: true, createdAt: true },
        orderBy: [{ name: "asc" }],
      });
    } catch {
      // Fallback for connectors that don't support `mode: "insensitive"`.
      const all = await prisma.simulator.findMany({
        select: { id: true, name: true, category: true, createdAt: true },
        orderBy: [{ name: "asc" }],
      });
      const needle = normalize(query);
      sims = all.filter((s) => normalize(s.name).includes(needle));
    }

    if (!sims || sims.length === 0) {
      console.log(`[simulators] 0 match for q=${JSON.stringify(query)}`);
      return;
    }

    console.log(`[simulators] ${sims.length} match(es) for q=${JSON.stringify(query)}`);
    for (const s of sims) {
      console.log(`- id=${s.id} | category=${String(s.category)} | name=${s.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[simulators] failed", e);
  process.exit(1);
});
