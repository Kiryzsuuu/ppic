"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

  const gestureRef = useRef<{ startX: number | null }>(
    { startX: null },
  );

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

  const goPrev = () => setActive((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setActive((i) => (i + 1) % slides.length);

  const onHeroClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("a,button")) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  };

  const onHeroPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("a,button")) return;
    gestureRef.current.startX = e.clientX;
    setPaused(true);
  };

  const onHeroPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const startX = gestureRef.current.startX;
    gestureRef.current.startX = null;
    setPaused(false);
    if (startX == null) return;

    const deltaX = e.clientX - startX;
    const threshold = 50;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX > 0) goPrev();
    else goNext();
  };

  return (
    <div className="grid gap-0">
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

          <div
            className="absolute inset-0"
            onClick={onHeroClick}
            onPointerDown={onHeroPointerDown}
            onPointerUp={onHeroPointerUp}
          >
            <div className="flex h-full w-full items-center">
              <div className="w-full max-w-4xl">
                <div
                  className="max-w-3xl border border-white/50 bg-white/70 py-6 pr-6 pl-10 shadow-lg backdrop-blur-sm sm:py-8 sm:pr-8 sm:pl-12"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold text-[#05164d]">PPI Curug Simulator Training</p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#05164d] sm:text-5xl">
                    Politeknik Penerbangan Indonesia Curug
                  </h1>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={authed ? "/user/booking/new" : "/register"}
                      className="inline-flex h-10 items-center justify-center bg-[#05164d] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#05164d]/90 hover:shadow"
                    >
                      {authed ? "Buat Booking" : "Mulai Registrasi"}
                    </Link>
                    <Link
                      href={authed ? "/dashboard" : "/login"}
                      className="inline-flex h-10 items-center justify-center border border-[#05164d]/25 bg-white px-4 text-sm font-semibold text-[#05164d] shadow-sm transition hover:bg-zinc-50 hover:shadow"
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
                          "h-2.5 w-2.5 border transition " +
                          (idx === active
                            ? "border-[#05164d] bg-[#05164d]"
                            : "border-[#05164d]/40 bg-[#05164d]/15 hover:bg-[#05164d]/25")
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us (directly under the hero image) */}
      <section className="border-t border-zinc-200 py-10 sm:py-12">
        <div className="grid gap-3">
          <h2 className="text-lg font-bold tracking-tight text-[#05164d]">About Us</h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            Politeknik Penerbangan Indonesia Curug (PPI Curug) is an Approved Training Organization (ATO) under the
            Indonesian Ministry of Transportation and approved by the Directorate of Airworthiness and Aircraft
            Operations (DKPPU). PPI Curug is responsible for conducting professional education and training in the
            field of civil aviation.
          </p>
        </div>
      </section>

      {/* Simulator Type */}
      <section className="border-t border-zinc-200 py-10 sm:py-12">
        <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-white/10 bg-[#05164d] px-4 py-3 text-white">
            <h2 className="text-base font-bold tracking-tight">Simulator Type</h2>
            <p className="mt-0.5 text-xs text-white/80">Pilih kategori simulator yang tersedia.</p>
          </div>

          <div className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "AIRBUS",
                  subtitle: "A320",
                  logoSrc: logos.airbusLogoSrc,
                  logoAlt: logos.airbusLogoAlt,
                  logoClassName: "object-contain",
                },
                {
                  title: "BOEING",
                  subtitle: "B737",
                  logoSrc: logos.boeingLogoSrc,
                  logoAlt: logos.boeingLogoAlt,
                  logoClassName: "object-contain",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="overflow-hidden border border-zinc-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow"
                >
                  <div className="relative h-44 w-full border-b border-zinc-200 sm:h-48">
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

                  <Link
                    href={authed ? "/user/booking/new" : "/register"}
                    className="flex h-11 w-full items-center justify-center bg-white px-4 text-sm font-bold text-[#05164d] transition-colors duration-200 hover:bg-zinc-50"
                  >
                    {authed ? `${s.title} ${s.subtitle}` : "Registrasi untuk Booking"}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SchedulePreview authed={authed} />

      {/* Map (outside footer, larger and centered) */}
      <section className="grid gap-3 border-t border-zinc-200 py-10 sm:py-12">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#05164d]">Map</h2>
          <p className="mt-1 text-sm text-zinc-600">Lokasi Politeknik Penerbangan Indonesia Curug.</p>
        </div>
        <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
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
