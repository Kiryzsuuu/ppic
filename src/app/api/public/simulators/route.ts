import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const simulators = await prisma.simulator.findMany({
    select: { id: true, category: true, name: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return jsonOk({ simulators });
}
