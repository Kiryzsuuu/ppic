import { getSessionFromCookies, type SessionPayload } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function requireSession() {
  const session = await getSessionFromCookies();
  if (!session) return { session: null, response: jsonError("Unauthorized", 401) };
  return { session, response: null };
}

export async function requireRole(roles: SessionPayload["role"][]) {
  const { session, response } = await requireSession();
  if (!session) return { session: null, response };
  if (!roles.includes(session.role)) return { session: null, response: jsonError("Forbidden", 403) };
  return { session, response: null };
}
