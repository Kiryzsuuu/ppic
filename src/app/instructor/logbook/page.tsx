"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type BookingRow = {
  id: string;
  trainingName: string;
  user: { username: string; profile?: { fullName: string; licenseNo: string | null } | null };
  simulator: { category: string; name: string };
  slot: { startAt: string; endAt: string };
  certificate?: { id: string } | null;
};

type BookingDetails = {
  id: string;
  trainingName: string;
  leaseType: string;
  status: string;
  user: {
    username: string;
    profile?: { fullName: string; licenseNo: string | null } | null;
  };
  simulator: { category: string; name: string };
  slot: { startAt: string; endAt: string } | null;
  certificate?: { id: string; data?: Record<string, unknown> | null } | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type CertificateTemplate = {
  certificateTitle?: string;
  certificateSubtitle?: string;
  issuedPlace?: string;
};

export default function InstructorLogbookPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("PASS");
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certTemplate, setCertTemplate] = useState<CertificateTemplate | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [certData, setCertData] = useState<Record<string, string>>({
    certificateTitle: "",
    certificateSubtitle: "",
    certificateNo: "",
    issuedPlace: "",
    issuedAt: "",
    recipientName: "",
    licenseNo: "",
    trainingName: "",
    simulatorLabel: "",
    scheduleStartAt: "",
    scheduleEndAt: "",
    result: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplate() {
      const res = await fetch("/api/instructor/settings/certificate-template");
      const json = (await res.json().catch(() => null)) as ApiRes<{ template: CertificateTemplate | null }> | null;
      if (!cancelled) {
        if (res.ok && json && json.ok) setCertTemplate(json.data.template);
        setTemplateLoaded(true);
      }
    }
    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Auto-save template fields (debounced)
    if (!templateLoaded) return;
    if (!certData.certificateTitle && !certData.certificateSubtitle && !certData.issuedPlace) return;

    const t = window.setTimeout(async () => {
      const next: CertificateTemplate = {
        certificateTitle: certData.certificateTitle,
        certificateSubtitle: certData.certificateSubtitle,
        issuedPlace: certData.issuedPlace,
      };

      // Optimistic local cache
      setCertTemplate(next);

      await fetch("/api/instructor/settings/certificate-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => null);
    }, 800);

    return () => {
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certData.certificateTitle, certData.certificateSubtitle, certData.issuedPlace]);

  useEffect(() => {
    // If template arrives after booking details, apply it only when fields are still defaults.
    if (!templateLoaded) return;
    if (!certTemplate) return;
    if (!details) return;
    if (details.certificate) return;

    setCertData((s) => {
      const next = { ...s };

      const titleIsDefault = !s.certificateTitle || s.certificateTitle === "SERTIFIKAT";
      const subtitleIsDefault = !s.certificateSubtitle || s.certificateSubtitle === "Pelatihan Simulator";
      const placeIsDefault = !s.issuedPlace || s.issuedPlace === "Curug";

      if (titleIsDefault && certTemplate.certificateTitle) next.certificateTitle = certTemplate.certificateTitle;
      if (subtitleIsDefault && certTemplate.certificateSubtitle) next.certificateSubtitle = certTemplate.certificateSubtitle;
      if (placeIsDefault && certTemplate.issuedPlace) next.issuedPlace = certTemplate.issuedPlace;

      return next;
    });
  }, [templateLoaded, certTemplate, details]);

  async function load() {
    setError(null);
    const res = await fetch("/api/instructor/bookings");
    const json = (await res.json().catch(() => null)) as ApiRes<{ bookings: BookingRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat data");
      return;
    }
    setBookings(json.data.bookings);
    if (!selectedId && json.data.bookings.length > 0) setSelectedId(json.data.bookings[0].id);
  }

  async function loadDetails(bookingId: string) {
    setCertLoading(true);
    const res = await fetch(`/api/instructor/bookings/${bookingId}/certificate`);
    const json = (await res.json().catch(() => null)) as ApiRes<{ booking: BookingDetails }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat detail booking");
      setCertLoading(false);
      return;
    }

    const b = json.data.booking;
    setDetails(b);

    const d = (b.certificate?.data || {}) as Record<string, unknown>;
    const simulatorLabel = `${b.simulator.category} ${b.simulator.name}`;
    const template = b.certificate ? null : certTemplate;

    const issuedAtDefault = (() => {
      const fromData = d.issuedAt;
      if (typeof fromData === "string" && fromData) return fromData;
      return b.certificate ? "" : new Date().toISOString();
    })();

    setCertData({
      certificateTitle: String(d.certificateTitle ?? template?.certificateTitle ?? "SERTIFIKAT"),
      certificateSubtitle: String(d.certificateSubtitle ?? template?.certificateSubtitle ?? "Pelatihan Simulator"),
      certificateNo: String(d.certificateNo ?? ""),
      issuedPlace: String(d.issuedPlace ?? template?.issuedPlace ?? "Curug"),
      issuedAt: String(issuedAtDefault),
      recipientName: String(d.recipientName ?? b.user.profile?.fullName ?? b.user.username ?? ""),
      licenseNo: String(d.licenseNo ?? b.user.profile?.licenseNo ?? ""),
      trainingName: String(d.trainingName ?? b.trainingName ?? ""),
      simulatorLabel: String(d.simulatorLabel ?? simulatorLabel),
      scheduleStartAt: String(d.scheduleStartAt ?? b.slot?.startAt ?? ""),
      scheduleEndAt: String(d.scheduleEndAt ?? b.slot?.endAt ?? ""),
      result: String(d.result ?? ""),
      notes: String(d.notes ?? ""),
    });

    setCertLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadDetails(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function submit() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/instructor/bookings/${selectedId}/logbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, result }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal simpan logbook");
      setLoading(false);
      return;
    }

    setNotes("");
    setLoading(false);
    await load();
  }

  const current = bookings.find((b) => b.id === selectedId);

  async function generateCertificate() {
    if (!selectedId) return;
    setCertLoading(true);
    setError(null);

    const res = await fetch(`/api/instructor/bookings/${selectedId}/certificate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: certData }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal generate sertifikat");
      setCertLoading(false);
      return;
    }
    await loadDetails(selectedId);
    setCertLoading(false);
  }

  async function saveCertificate() {
    if (!selectedId) return;
    setCertLoading(true);
    setError(null);

    const res = await fetch(`/api/instructor/bookings/${selectedId}/certificate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: certData }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal menyimpan sertifikat");
      setCertLoading(false);
      return;
    }

    await loadDetails(selectedId);
    setCertLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logbook (Wet Leased)</h1>
        <p className="mt-1 text-sm text-zinc-600">Pilih booking, lalu isi hasil pelatihan.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Booking</span>
          <select className="h-10 rounded-lg border border-zinc-200 px-3" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.user.username} — {b.simulator.category} {b.simulator.name} — {b.trainingName}
              </option>
            ))}
          </select>
        </label>

        {current ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Jadwal: {new Date(current.slot.startAt).toLocaleString()} - {new Date(current.slot.endAt).toLocaleString()}
          </div>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Hasil</span>
          <input className="h-10 rounded-lg border border-zinc-200 px-3" value={result} onChange={(e) => setResult(e.target.value)} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Catatan</span>
          <textarea className="min-h-28 rounded-lg border border-zinc-200 px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button disabled={loading} onClick={submit} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
          {loading ? "Menyimpan..." : "Simpan Logbook"}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 grid gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tight">Sertifikat</div>
          <div className="mt-1 text-sm text-zinc-600">Generate sertifikat untuk penerbang dan edit isinya.</div>
        </div>

        {!selectedId ? (
          <div className="text-sm text-zinc-600">Pilih booking terlebih dahulu.</div>
        ) : certLoading ? (
          <div className="text-sm text-zinc-600">Memuat...</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Judul (besar)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.certificateTitle}
                  onChange={(e) => setCertData((s) => ({ ...s, certificateTitle: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Subjudul</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.certificateSubtitle}
                  onChange={(e) => setCertData((s) => ({ ...s, certificateSubtitle: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Nomor Sertifikat (opsional)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.certificateNo}
                  onChange={(e) => setCertData((s) => ({ ...s, certificateNo: e.target.value }))}
                  placeholder="Kosongkan untuk auto"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Tempat Terbit</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.issuedPlace}
                  onChange={(e) => setCertData((s) => ({ ...s, issuedPlace: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Tanggal Terbit (ISO, opsional)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.issuedAt}
                  onChange={(e) => setCertData((s) => ({ ...s, issuedAt: e.target.value }))}
                  placeholder={new Date().toISOString()}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Nama Penerbang</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.recipientName}
                  onChange={(e) => setCertData((s) => ({ ...s, recipientName: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">License No</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.licenseNo}
                  onChange={(e) => setCertData((s) => ({ ...s, licenseNo: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Training (otomatis mengikuti booking, boleh diubah)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.trainingName}
                  onChange={(e) => setCertData((s) => ({ ...s, trainingName: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Simulator</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.simulatorLabel}
                  onChange={(e) => setCertData((s) => ({ ...s, simulatorLabel: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Mulai (ISO)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.scheduleStartAt}
                  onChange={(e) => setCertData((s) => ({ ...s, scheduleStartAt: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Selesai (ISO)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.scheduleEndAt}
                  onChange={(e) => setCertData((s) => ({ ...s, scheduleEndAt: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Result</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={certData.result}
                  onChange={(e) => setCertData((s) => ({ ...s, result: e.target.value }))}
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Notes</span>
              <textarea
                className="min-h-28 rounded-lg border border-zinc-200 px-3 py-2"
                value={certData.notes}
                onChange={(e) => setCertData((s) => ({ ...s, notes: e.target.value }))}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {details?.certificate ? (
                <button
                  disabled={certLoading}
                  onClick={saveCertificate}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {certLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              ) : (
                <button
                  disabled={certLoading}
                  onClick={generateCertificate}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {certLoading ? "Memproses..." : "Generate Sertifikat"}
                </button>
              )}

              {details?.certificate ? (
                <a
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm hover:bg-zinc-50"
                  href={`/user/certificates/${details.certificate.id}`}
                >
                  Lihat Sertifikat
                </a>
              ) : null}
            </div>

            {details?.certificate ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-semibold">QR Preview</div>
                <div className="mt-3 flex items-center justify-center">
                  <Image
                    alt="Certificate QR"
                    src={`/api/certificates/${details.certificate.id}/qrcode`}
                    width={240}
                    height={240}
                    unoptimized
                    className="h-[240px] w-[240px] rounded-xl border border-zinc-200 bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Sertifikat belum dibuat. Isi field di atas untuk mengatur default/template, lalu klik <span className="font-medium">Generate Sertifikat</span>.
              </div>
            )}
          </>
        )}
      </section>

      <div className="text-sm">
        <a className="underline" href="/instructor/dashboard">Kembali ke Dashboard</a>
      </div>
    </div>
  );
}
