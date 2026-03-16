"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; details?: unknown } };

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

async function uploadLandingImage(file: File, kind: "hero" | "logo") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);

  const res = await fetch("/api/admin/landing-images/upload", {
    method: "POST",
    body: form,
  });

  const json = (await res.json().catch(() => null)) as ApiRes<{ url: string }> | null;
  if (!res.ok || !json || !json.ok) {
    throw new Error(json && !json.ok ? json.error.message : "Gagal upload gambar");
  }
  return json.data.url;
}

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [config, setConfig] = useState<LandingConfig>(DEFAULT_CONFIG);

  const heroSlides = config.heroSlides;

  const canSave = useMemo(() => {
    return (
      config.heroSlides.length >= 1 &&
      config.heroSlides.every((s) => s.src.trim() && s.alt.trim()) &&
      config.simulatorLogos.airbusLogoSrc.trim() &&
      config.simulatorLogos.airbusLogoAlt.trim() &&
      config.simulatorLogos.boeingLogoSrc.trim() &&
      config.simulatorLogos.boeingLogoAlt.trim()
    );
  }, [config]);

  async function load() {
    setLoading(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/public/landing");
    const json = (await res.json().catch(() => null)) as ApiRes<{ config: LandingConfig }> | null;
    if (!res.ok || !json || !json.ok) {
      setError("Gagal memuat konfigurasi landing page");
      setLoading(false);
      return;
    }

    setConfig(json.data.config);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/admin/landing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = (await res.json().catch(() => null)) as ApiRes<{ saved: boolean }> | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : "Gagal menyimpan");
        setLoading(false);
        return;
      }
      setInfo("Konfigurasi landing page tersimpan.");
      setLoading(false);
    } catch {
      setError("Gagal menyimpan");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landing Page</h1>
          <p className="mt-1 text-sm text-zinc-600">Admin bisa mengganti gambar hero slideshow dan logo simulator.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">
          Kembali
        </a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {info ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Preview Hero</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {heroSlides.slice(0, 2).map((s, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl border border-zinc-200">
              <div className="relative h-40 w-full">
                <Image src={s.src} alt={s.alt} fill unoptimized className="object-cover" />
              </div>
              <div className="p-3 text-xs text-zinc-600">{s.alt}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Hero Slideshow</div>
            <div className="mt-1 text-sm text-zinc-600">Atur minimal 1 slide (disarankan 2).</div>
          </div>
          <button
            type="button"
            disabled={loading || config.heroSlides.length >= 10}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                heroSlides: c.heroSlides.concat({ src: "", alt: "" }),
              }))
            }
          >
            + Tambah Slide
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {config.heroSlides.map((s, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Slide {idx + 1}</div>
                <button
                  type="button"
                  disabled={loading || config.heroSlides.length <= 1}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      heroSlides: c.heroSlides.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Hapus
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-zinc-600">URL Gambar</span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
                    value={s.src}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        heroSlides: c.heroSlides.map((x, i) => (i === idx ? { ...x, src: e.target.value } : x)),
                      }))
                    }
                    placeholder="https://... atau /api/public/landing-images/..."
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-zinc-600">Alt Text</span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
                    value={s.alt}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        heroSlides: c.heroSlides.map((x, i) => (i === idx ? { ...x, alt: e.target.value } : x)),
                      }))
                    }
                    placeholder="Deskripsi gambar"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-zinc-600">Upload (opsional)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full text-sm"
                    disabled={loading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setLoading(true);
                      setError(null);
                      setInfo(null);
                      try {
                        const url = await uploadLandingImage(f, "hero");
                        setConfig((c) => ({
                          ...c,
                          heroSlides: c.heroSlides.map((x, i) => (i === idx ? { ...x, src: url } : x)),
                        }));
                        setInfo("Upload berhasil. Jangan lupa klik Simpan.");
                      } catch (err: any) {
                        setError(err?.message || "Gagal upload");
                      } finally {
                        setLoading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Logo Simulator</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[{ key: "airbus" as const, title: "AIRBUS" }, { key: "boeing" as const, title: "BOEING" }].map((k) => {
            const src = k.key === "airbus" ? config.simulatorLogos.airbusLogoSrc : config.simulatorLogos.boeingLogoSrc;
            const alt = k.key === "airbus" ? config.simulatorLogos.airbusLogoAlt : config.simulatorLogos.boeingLogoAlt;
            return (
              <div key={k.key} className="rounded-xl border border-zinc-200 p-4">
                <div className="text-sm font-medium">{k.title}</div>
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
                  <div className="relative h-32 w-full">
                    <Image src={src} alt={alt} fill unoptimized className="object-contain" />
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-zinc-600">URL Gambar</span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
                      value={src}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          simulatorLogos:
                            k.key === "airbus"
                              ? { ...c.simulatorLogos, airbusLogoSrc: e.target.value }
                              : { ...c.simulatorLogos, boeingLogoSrc: e.target.value },
                        }))
                      }
                      placeholder="https://... atau /api/public/landing-images/..."
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-zinc-600">Alt Text</span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
                      value={alt}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          simulatorLogos:
                            k.key === "airbus"
                              ? { ...c.simulatorLogos, airbusLogoAlt: e.target.value }
                              : { ...c.simulatorLogos, boeingLogoAlt: e.target.value },
                        }))
                      }
                      placeholder="Deskripsi logo"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-zinc-600">Upload (opsional)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="block w-full text-sm"
                      disabled={loading}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setLoading(true);
                        setError(null);
                        setInfo(null);
                        try {
                          const url = await uploadLandingImage(f, "logo");
                          setConfig((c) => ({
                            ...c,
                            simulatorLogos:
                              k.key === "airbus"
                                ? { ...c.simulatorLogos, airbusLogoSrc: url }
                                : { ...c.simulatorLogos, boeingLogoSrc: url },
                          }));
                          setInfo("Upload berhasil. Jangan lupa klik Simpan.");
                        } catch (err: any) {
                          setError(err?.message || "Gagal upload");
                        } finally {
                          setLoading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
          onClick={() => void load()}
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={loading || !canSave}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          onClick={() => void save()}
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
