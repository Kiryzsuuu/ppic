import { jsonError, jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import { issueEmailOtp } from "@/lib/emailVerification";

export async function POST() {
  const { session, response } = await requireSession();
  if (!session) return response;

  try {
    const { expiresAt, delivery } = await issueEmailOtp(session.userId);
    return jsonOk({ expiresAt, delivery });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Gagal mengirim OTP", 400);
  }
}
