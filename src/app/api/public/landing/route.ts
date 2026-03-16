import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http";
import { getSettingJson } from "@/lib/settings";

type Slide = { src: string; alt: string };

type LandingConfig = {
  heroSlides: Slide[];
  simulatorLogos: {
    airbusLogoSrc: string;
    airbusLogoAlt: string;
    boeingLogoSrc: string;
    boeingLogoAlt: string;
  };
};

const DEFAULT_CONFIG: LandingConfig = {
  heroSlides: [
    {
      src: "https://media.istockphoto.com/id/155395844/photo/cockpit-of-airbus-a320-on-runway-ready-for-take-off.webp?a=1&b=1&s=612x612&w=0&k=20&c=2s4udFnUGTbxf4sF92SU2oQ4HIbtl74uCt_CBLTkLzw=",
      alt: "Cockpit Airbus A320 di runway",
    },
    {
      src: "https://images.unsplash.com/flagged/photo-1579750481098-8b3a62c9b85d?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Simulator / training environment",
    },
  ],
  simulatorLogos: {
    airbusLogoSrc: "https://i.pinimg.com/736x/f4/e8/b4/f4e8b4adc1cda828a3e6a6c540457f94.jpg",
    airbusLogoAlt: "Airbus",
    boeingLogoSrc: "https://i.pinimg.com/1200x/0d/3e/20/0d3e206d0260abc65a7d0c2509938242.jpg",
    boeingLogoAlt: "Boeing",
  },
};

export async function GET(_req: NextRequest) {
  const heroSlides = await getSettingJson<Slide[]>("landing.hero.slides", DEFAULT_CONFIG.heroSlides);
  const simulatorLogos = await getSettingJson<LandingConfig["simulatorLogos"]>(
    "landing.simulator.logos",
    DEFAULT_CONFIG.simulatorLogos,
  );

  return jsonOk(
    {
      config: {
        heroSlides,
        simulatorLogos,
      } satisfies LandingConfig,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
