import { jsonOk } from "@/lib/http";
import { clearSessionCookie, getSessionFromCookies } from "@/lib/session";
import { getClientIpFromHeaders, writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (session) {
    const ip = getClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    try {
      await writeAuditLog({
        actorId: session.userId,
        actorRole: session.role,
        action: "auth.logout",
        targetType: "User",
        targetId: session.userId,
        ip,
        userAgent,
      });
    } catch {
      // ignore
    }
  }

  await clearSessionCookie();
  return jsonOk({});
}
