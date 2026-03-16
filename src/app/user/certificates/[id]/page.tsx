"use client";

import Image from "next/image";
import { useParams } from "next/navigation";

export default function UserCertificatePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <div className="mx-auto max-w-xl grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sertifikat Digital</h1>
        <p className="mt-1 text-sm text-zinc-600">Tunjukkan QR/Barcode ini sebagai bukti sertifikasi pelatihan.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">QR / Barcode</div>
        <div className="mt-4 flex items-center justify-center">
          {/* image served via authenticated API */}
          <Image
            alt="Certificate QR"
            src={`/api/certificates/${id}/qrcode`}
            width={360}
            height={360}
            unoptimized
            className="h-[360px] w-[360px] rounded-xl border border-zinc-200 bg-white"
          />
        </div>
        <div className="mt-4 text-xs text-zinc-500">Jika QR tidak tampil, pastikan Anda login dan memiliki akses ke sertifikat.</div>
      </div>

      <div className="text-sm">
        <a className="underline" href="/user/dashboard">Kembali ke Dashboard</a>
      </div>
    </div>
  );
}
