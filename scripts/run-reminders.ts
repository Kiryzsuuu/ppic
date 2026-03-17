import "dotenv/config";

import { runSimulatorReminders } from "@/lib/reminders";

function getArgValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name);
}

async function main() {
  const dryRun = hasFlag("--dryRun") || hasFlag("--dry-run");
  const limitRaw = getArgValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const res = await runSimulatorReminders({ dryRun, limit: Number.isFinite(limit) ? limit : undefined });
  console.log(res);

  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
