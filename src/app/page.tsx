"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SchedulePreview from "@/app/SchedulePreview";

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; details?: unknown } };

type Slide = {
  src: string;
  alt: string;
};

type LandingConfig = {
  heroSlides: Slide[];
  simulatorLogos: {
    airbusLogoSrc: string;
    airbusLogoAlt: string;
    boeingLogoSrc: string;
    boeingLogoAlt: string;
  };
};

export default function Home() {
  const defaultSlides = useMemo<Slide[]>(
    () => [
      {
        src: "https://images.unsplash.com/photo-1662242723207-13ad21d3816f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        alt: "Cockpit Airbus A320 di runway",
      },
      {
        src: "https://images.unsplash.com/photo-1598087582627-7e976c49bb03?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDN8fHxlbnwwfHx8fHw%3D",
        alt: "Simulator / training environment",
      },
    ],
    [],
  );

  const defaultLogos = useMemo(
    () => ({
      airbusLogoSrc: "https://i.pinimg.com/736x/f4/e8/b4/f4e8b4adc1cda828a3e6a6c540457f94.jpg",
      airbusLogoAlt: "Airbus",
      boeingLogoSrc: "https://i.pinimg.com/1200x/0d/3e/20/0d3e206d0260abc65a7d0c2509938242.jpg",
      boeingLogoAlt: "Boeing",
    }),
    [],
  );

  const [slides, setSlides] = useState<Slide[]>(defaultSlides);
  const [logos, setLogos] = useState<LandingConfig["simulatorLogos"]>(defaultLogos);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // load landing config (public)
      const landingRes = await fetch("/api/public/landing", { cache: "no-store" });
      const landingJson = (await landingRes.json().catch(() => null)) as ApiRes<{ config: LandingConfig }> | null;
      if (!cancelled && landingRes.ok && landingJson && landingJson.ok) {
        const cfg = landingJson.data.config;
        if (Array.isArray(cfg.heroSlides) && cfg.heroSlides.length) setSlides(cfg.heroSlides);
        if (cfg.simulatorLogos) setLogos(cfg.simulatorLogos);
      }

      const res = await fetch("/api/me", { cache: "no-store" });
      if (cancelled) return;
      setAuthed(res.ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  const activeSlide = slides[active];

  return (
    <div className="grid gap-10">
      {/* Hero with slideshow */}
      <section
        className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen overflow-hidden bg-white"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative h-[420px] w-full sm:h-[560px]">
          <Image
            key={activeSlide.src}
            src={activeSlide.src}
            alt={activeSlide.alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/10" />

          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90">
                  PPI Curug Simulator Training
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Politeknik Penerbangan Indonesia Curug
                </h1>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={authed ? "/user/booking/new" : "/register"}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    {authed ? "Buat Booking" : "Mulai Registrasi"}
                  </Link>
                  <Link
                    href={authed ? "/dashboard" : "/login"}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
                  >
                    {authed ? "Dashboard" : "Login"}
                  </Link>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Slide ${idx + 1}`}
                      onClick={() => setActive(idx)}
                      className={
                        "h-2.5 w-2.5 rounded-full border transition " +
                        (idx === active
                          ? "border-white bg-white"
                          : "border-white/60 bg-white/20 hover:bg-white/30")
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setActive((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/15 sm:inline-flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setActive((i) => (i + 1) % slides.length)}
            className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/15 sm:inline-flex"
          >
            ›
          </button>
        </div>
      </section>

      {/* About Us (directly under the hero image) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">About Us</h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            Politeknik Penerbangan Indonesia Curug (PPI Curug) is an Approved Training Organization (ATO) under the
            Indonesian Ministry of Transportation and approved by the Directorate of Airworthiness and Aircraft
            Operations (DKPPU). PPI Curug is responsible for conducting professional education and training in the
            field of civil aviation.
          </p>
        </div>
      </section>

      {/* Simulator Type */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Simulator Type</h2>
          <p className="mt-1 text-sm text-zinc-600">Pilih kategori simulator yang tersedia.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[{
            title: "AIRBUS",
            subtitle: "A320",
            logoSrc: logos.airbusLogoSrc,
            logoAlt: logos.airbusLogoAlt,
            logoClassName: "object-contain",
          }, {
            title: "BOEING",
            subtitle: "B737",
            logoSrc: logos.boeingLogoSrc,
            logoAlt: logos.boeingLogoAlt,
            logoClassName: "object-contain",
          }].map((s) => (
            <div key={s.title} className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="grid gap-4">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-0">
                  <div className="relative h-44 w-full sm:h-48">
                    <div className="absolute inset-6">
                      <Image
                        src={s.logoSrc}
                        alt={s.logoAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 520px"
                        className={s.logoClassName}
                      />
                    </div>
                  </div>
                </div>
                <Link
                  href={authed ? "/user/booking/new" : "/register"}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  {authed ? `${s.title} ${s.subtitle}` : "Registrasi untuk Booking"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SchedulePreview authed={authed} />

      {/* Map (outside footer, larger and centered) */}
      <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Map</h2>
          <p className="mt-1 text-sm text-zinc-600">Lokasi Politeknik Penerbangan Indonesia Curug.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <iframe
            title="Google Maps - Politeknik Penerbangan Indonesia Curug"
            src="https://www.google.com/maps?cid=12588833650276155690&output=embed"
            className="h-[420px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </div>
  );
}
