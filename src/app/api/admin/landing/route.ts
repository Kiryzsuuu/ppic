import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getSettingJson, setSettingJson } from "@/lib/settings";

const SlideSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
});

const LandingUpdateSchema = z.object({
  heroSlides: z.array(SlideSchema).min(1).max(10),
  simulatorLogos: z.object({
    airbusLogoSrc: z.string().min(1),
    airbusLogoAlt: z.string().min(1),
    boeingLogoSrc: z.string().min(1),
    boeingLogoAlt: z.string().min(1),
  }),
});

export async function GET(_req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  // Reuse the same defaults as public endpoint by calling it directly would be overkill.
  // Return whatever is saved; UI can show current values.
  const heroSlides = await getSettingJson<any>("landing.hero.slides", null);
  const simulatorLogos = await getSettingJson<any>("landing.simulator.logos", null);

  return jsonOk({
    config: {
      heroSlides,
      simulatorLogos,
    },
  });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = LandingUpdateSchema.parse(body);

    await Promise.all([
      setSettingJson("landing.hero.slides", input.heroSlides),
      setSettingJson("landing.simulator.logos", input.simulatorLogos),
    ]);

    return jsonOk({ saved: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
