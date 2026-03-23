"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PrintButton from "@/app/PrintButton";

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type CertificateJson = {
  id: string;
  qrValue: string;
  issuedAt: string;
  updatedAt: string;
  data?: Record<string, unknown> | null;
  issuedBy: { username: string; role: string };
  booking: {
    id: string;
    trainingName: string;
    leaseType: string;
    user: { username: string; profile?: { fullName: string; licenseNo: string | null } | null };
    simulator: { category: string; name: string };
    slot: { startAt: string; endAt: string } | null;
  };
};

export default function UserCertificatePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const searchParams = useSearchParams();
  const isPrintView = searchParams.get("print") === "1";

  const [cert, setCert] = useState<CertificateJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      const res = await fetch(`/api/certificates/${id}`);
      const json = (await res.json().catch(() => null)) as ApiRes<{ certificate: CertificateJson }> | null;
      if (!res.ok || !json || !json.ok) {
        if (!cancelled) setError(json && !json.ok ? json.error.message : "Gagal memuat sertifikat");
        return;
      }
      if (!cancelled) setCert(json.data.certificate);
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const data = (cert?.data || {}) as Record<string, unknown>;

  const rawTitle = String(data.certificateTitle ?? "").trim();
  const rawSubtitle = String(data.certificateSubtitle ?? "").trim();

  // Keep the main heading visually stable.
  // If existing data stored a long sentence as the title, move it to subtitle.
  const title = (() => {
    if (!rawTitle) return "SERTIFIKAT";
    const isLong = rawTitle.length > 18 || rawTitle.includes(" ");
    return isLong ? "SERTIFIKAT" : rawTitle;
  })();
  const subtitle = (() => {
    if (rawSubtitle) return rawSubtitle;
    if (rawTitle && (rawTitle.length > 18 || rawTitle.includes(" "))) return rawTitle;
    return "Pelatihan Simulator";
  })();

  const isCompactTitle = title.length <= 12 && !title.includes(" ");
  const certificateNo = String(
    data.certificateNo ?? (cert ? `CERT-${cert.id.slice(-10).toUpperCase()}` : "-")
  );

  const recipientName = String(
    data.recipientName ??
      cert?.booking.user.profile?.fullName ??
      cert?.booking.user.username ??
      "-"
  );
  const licenseNo = String(
    data.licenseNo ??
      cert?.booking.user.profile?.licenseNo ??
      "-"
  );
  const trainingName = String(data.trainingName ?? cert?.booking.trainingName ?? "-");
  const simulatorLabel = String(
    data.simulatorLabel ??
      (cert ? `${cert.booking.simulator.category} ${cert.booking.simulator.name}` : "-")
  );
  const scheduleStartAt = String(data.scheduleStartAt ?? cert?.booking.slot?.startAt ?? "");
  const scheduleEndAt = String(data.scheduleEndAt ?? cert?.booking.slot?.endAt ?? "");
  const result = String(data.result ?? "");
  const notes = String(data.notes ?? "");
  const issuedPlace = String(data.issuedPlace ?? "Curug");
  const issuedAtIso = String(data.issuedAt ?? cert?.issuedAt ?? "");

  const issuedAtLabel = (() => {
    if (!issuedAtIso) return "";
    const d = new Date(issuedAtIso);
    if (Number.isNaN(d.getTime())) return String(issuedAtIso);
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(d);
  })();

  const scheduleLabel = (() => {
    if (!scheduleStartAt) return "";
    const start = new Date(scheduleStartAt);
    const end = scheduleEndAt ? new Date(scheduleEndAt) : null;
    if (Number.isNaN(start.getTime())) return `${scheduleStartAt}${scheduleEndAt ? ` - ${scheduleEndAt}` : ""}`;
    const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(start);
    const time = (v: Date) => new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(v);
    if (!end || Number.isNaN(end.getTime())) return date;
    return `${date} (${time(start)} - ${time(end)})`;
  })();

  return (
    <div className={isPrintView ? "grid gap-6" : "mx-auto max-w-5xl grid gap-6"}>
      {/* Print rules scoped to this route */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .certificate-print-root {
            width: 100% !important;
            height: 100% !important;
          }

          .certificate-sheet {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
          }

          .certificate-canvas {
            aspect-ratio: auto !important;
            height: 100% !important;
          }

          .certificate-outer {
            overflow: visible !important;
          }
        }
      `}</style>

      {!isPrintView ? (
        <div className="flex flex-wrap items-start justify-between gap-3" data-print-hidden="true">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sertifikat</h1>
            <p className="mt-1 text-sm text-zinc-600">Cetak atau simpan sebagai PDF untuk kebutuhan administrasi.</p>
          </div>

          <div className="flex items-center gap-2">
            <PrintButton />
            <Link
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50"
              href="/user/dashboard"
            >
              Kembali
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-print-hidden="true">
          {error}
        </div>
      ) : null}

      {/* Certificate sheet */}
      <div
        className={
          "certificate-outer mx-auto w-full bg-white " +
          (isPrintView ? "" : "rounded-2xl border border-zinc-200")
        }
        style={{ maxWidth: "297mm" }}
      >
        <div
          className={
            "certificate-sheet certificate-canvas relative w-full " +
            (isPrintView ? "" : "overflow-hidden")
          }
          style={{ aspectRatio: "297 / 210" }}
        >
          {/* subtle background accents */}
          <div className="absolute inset-0 bg-zinc-50" />
          <div className={"absolute bg-white " + (isPrintView ? "inset-0 border border-zinc-200" : "inset-5 rounded-2xl border-2 border-zinc-200")} />

          <div className="certificate-print-root absolute inset-0 p-6 sm:p-10">
            <div className="grid h-full grid-rows-[auto_1fr_auto] gap-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-3">
                  <Image
                    alt="Logo PPIC"
                    src="/logoppic/logoppic.7a5aa04c.png"
                    width={72}
                    height={56}
                    unoptimized
                    className="h-14 w-auto"
                  />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold tracking-tight">Politeknik Penerbangan Indonesia</div>
                    <div className="text-sm text-zinc-600">Curug — Simulator Training</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest text-zinc-500">Nomor</div>
                  <div className="text-sm font-semibold tracking-tight">{certificateNo}</div>
                  {issuedAtLabel ? (
                    <div className="mt-1 text-xs text-zinc-600">
                      {issuedPlace}{issuedPlace ? ", " : ""}{issuedAtLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  className={
                    isCompactTitle
                      ? "text-4xl font-semibold tracking-[0.25em]"
                      : "text-3xl sm:text-4xl font-semibold tracking-tight"
                  }
                >
                  {title}
                </div>
                <div className="mt-2 text-sm uppercase tracking-[0.35em] text-zinc-600">{subtitle}</div>

                <div className="mt-10 text-sm text-zinc-600">Diberikan kepada</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{recipientName}</div>
                <div className="mt-2 text-sm text-zinc-700">
                  <span className="font-medium">License No:</span> {licenseNo}
                </div>

                <div className="mt-8 max-w-3xl text-sm text-zinc-700">
                  Telah mengikuti <span className="font-medium">{trainingName}</span> pada simulator <span className="font-medium">{simulatorLabel}</span>
                  {scheduleLabel ? (
                    <>
                      {" "}dengan jadwal <span className="font-medium">{scheduleLabel}</span>
                    </>
                  ) : null}.
                </div>

                {(result || notes) ? (
                  <div className="mt-6 grid gap-2 text-sm text-zinc-700">
                    {result ? (
                      <div>
                        <span className="font-medium">Hasil:</span> {result}
                      </div>
                    ) : null}
                    {notes ? (
                      <div className="max-w-3xl">
                        <span className="font-medium">Catatan:</span> {notes}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="grid grid-cols-[1fr_200px] items-end gap-10">
                <div className="grid gap-3">
                  <div className="text-xs uppercase tracking-widest text-zinc-500">Diterbitkan oleh</div>
                  <div className="h-14" />
                  <div className="border-t border-zinc-300 pt-2 text-sm font-medium">
                    {cert?.issuedBy.username ?? "-"}
                  </div>
                  <div className="text-xs text-zinc-600">{cert?.issuedBy.role ?? ""}</div>
                </div>

                <div className="grid justify-items-end gap-2">
                  <div className="text-xs uppercase tracking-widest text-zinc-500">Verifikasi</div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-2">
                    <Image
                      alt="Certificate QR"
                      src={`/api/certificates/${id}/qrcode`}
                      width={120}
                      height={120}
                      unoptimized
                      className="h-[120px] w-[120px]"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500">Scan QR untuk validasi.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isPrintView ? (
        <div className="text-xs text-zinc-500" data-print-hidden="true">
          Tips: untuk hasil terbaik, pilih kertas A4 dan orientasi <span className="font-medium">Landscape</span> saat mencetak.
        </div>
      ) : null}
    </div>
  );
}
