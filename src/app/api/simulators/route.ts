import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;

  const simulators = await prisma.simulator.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return jsonOk({ simulators });
}
