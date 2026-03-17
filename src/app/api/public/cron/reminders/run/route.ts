import { jsonError, jsonOk } from "@/lib/http";
import { runSimulatorReminders } from "@/lib/reminders";

function isAuthorized(req: Request) {
  const expected = process.env.REMINDER_CRON_SECRET?.trim();

  // In production we require a secret.
  if (process.env.NODE_ENV === "production" && !expected) {
    return { ok: false as const, error: jsonError("Server not configured: missing REMINDER_CRON_SECRET", 500) };
  }

  // If no secret configured (dev), allow.
  if (!expected) return { ok: true as const, error: null };

  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (headerSecret && headerSecret === expected) return { ok: true as const, error: null };

  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token === expected) return { ok: true as const, error: null };
  }

  return { ok: false as const, error: jsonError("Unauthorized", 401) };
}

export async function GET(req: Request) {
  const authz = isAuthorized(req);
  if (!authz.ok) return authz.error;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const result = await runSimulatorReminders({ dryRun, limit: Number.isFinite(limit) ? limit : undefined });
  return jsonOk(result);
}

export async function POST(req: Request) {
  return GET(req);
}
