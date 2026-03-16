"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Booking = {
  id: string;
  simulatorId: string;
  status: string;
  leaseType: "WET" | "DRY";
  trainingName: string;
  simulator: { category: string; name: string };
  payment?: { id: string; status: string; vaNumber: string } | null;
  slot?: { startAt: string; endAt: string } | null;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  legalDocument?: { type: string; status: string } | null;
  certificate?: { id: string } | null;
};

type Slot = { id: string; startAt: string; endAt: string; status: string };

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const dateTimeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
  }, []);

  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? dateTimeFormatter.format(d) : iso;
  }

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  async function load() {
    const res = await fetch(`/api/bookings/${id}`);
    const json = (await res.json().catch(() => null)) as ApiRes<{ booking: Booking }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat booking");
      return;
    }
    setBooking(json.data.booking);

    const b = json.data.booking;
    if (b.leaseType === "WET" && b.payment?.status === "VALIDATED" && !b.slot) {
      const slotRes = await fetch(`/api/slots?simulatorId=${encodeURIComponent(b.simulatorId)}`);
      const slotJson = await slotRes.json().catch(() => null);
      if (slotRes.ok && slotJson?.ok) {
        setSlots(slotJson.data.slots);
        const available = (slotJson.data.slots as Slot[]).filter((s) => s.status === "AVAILABLE");
        const nextId =
          (selectedSlotId && (slotJson.data.slots as Slot[]).some((s) => s.id === selectedSlotId && s.status === "AVAILABLE")
            ? selectedSlotId
            : (available[0]?.id ?? ""));
        setSelectedSlotId(nextId);
      }
    } else {
      setSlots([]);
      setSelectedSlotId("");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitBooking() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${id}/submit`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal submit");
      setLoading(false);
      return;
    }
    await load();
    setLoading(false);
  }

  async function markPaid() {
    if (!booking?.payment?.id) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    if (proofFile) form.append("file", proofFile);

    const res = await fetch(`/api/payments/${booking.payment.id}/mark-paid`, { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal update pembayaran");
      setLoading(false);
      return;
    }

    setProofFile(null);
    await load();
    setLoading(false);
  }

  async function selectSlot() {
    if (!selectedSlotId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/bookings/${id}/select-slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: selectedSlotId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal memilih slot");
      setLoading(false);
      return;
    }

    await load();
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Detail Booking</h1>
          <p className="mt-1 text-sm text-zinc-600">Pantau status verifikasi, dokumen legal, pembayaran, jadwal, dan sertifikat.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/user/dashboard">Kembali</a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!booking ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Loading...</div>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{booking.simulator.category} {booking.simulator.name}</div>
              <div className="text-xs text-zinc-600">Status: <span className="font-medium">{booking.status}</span></div>
            </div>
            <div className="mt-1 text-sm text-zinc-600">{booking.leaseType} • {booking.trainingName}</div>

            {booking.status === "DRAFT" ? (
              <button disabled={loading} onClick={submitBooking} className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
                {loading ? "Mengirim..." : "Submit untuk Verifikasi Admin"}
              </button>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Kontrak & Pembayaran</div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-700">
              <div>Dokumen legal: <span className="font-medium">{booking.legalDocument?.type ?? "-"}</span> ({booking.legalDocument?.status ?? "-"})</div>
              <div>Pembayaran: <span className="font-medium">{booking.payment?.status ?? "-"}</span> (VA: {booking.payment?.vaNumber ?? "-"})</div>
            </div>

            {booking.payment?.status === "UNPAID" ? (
              <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-medium">Upload bukti bayar (opsional)</div>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                <button disabled={loading} onClick={markPaid} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
                  {loading ? "Memproses..." : "Saya Sudah Membayar"}
                </button>
                <div className="text-xs text-zinc-500">Finance akan memvalidasi pembayaran Anda.</div>
              </div>
            ) : null}

            {booking.payment?.status === "PAID" || booking.status === "PAYMENT_VALIDATION" ? (
              <div className="mt-3 text-xs text-zinc-500">Menunggu validasi Finance.</div>
            ) : null}

            {booking.payment ? null : (
              <div className="mt-3 text-xs text-zinc-500">Menunggu Finance menerbitkan dokumen legal & VA.</div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Jadwal</div>
            <div className="mt-2 text-sm text-zinc-700">
              {booking.slot ? (
                <div>{fmtDateTime(booking.slot.startAt)} - {fmtDateTime(booking.slot.endAt)}</div>
              ) : booking.requestedStartAt && booking.requestedEndAt ? (
                <div>{fmtDateTime(booking.requestedStartAt)} - {fmtDateTime(booking.requestedEndAt)}</div>
              ) : (
                <div className="text-zinc-600">Belum ada jadwal.</div>
              )}
            </div>

            {booking.leaseType === "WET" && booking.payment?.status === "VALIDATED" && !booking.slot ? (
              <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-medium">Pilih Slot Jadwal</div>
                {slots.length === 0 ? (
                  <div className="text-sm text-zinc-600">Belum ada slot tersedia. Hubungi Admin untuk membuat slot.</div>
                ) : (
                  <>
                    <select className="h-10 rounded-lg border border-zinc-200 px-3" value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value)}>
                      {slots.map((s) => (
                        <option key={s.id} value={s.id} disabled={s.status !== "AVAILABLE"}>
                          {fmtDateTime(s.startAt)} - {fmtDateTime(s.endAt)} {s.status === "AVAILABLE" ? "" : `(${s.status})`}
                        </option>
                      ))}
                    </select>
                    <button disabled={loading} onClick={selectSlot} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
                      {loading ? "Menyimpan..." : "Kunci Jadwal"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-500">
                {booking.leaseType === "WET"
                  ? "Slot jadwal dipilih setelah pembayaran tervalidasi."
                  : "Jadwal yang ditampilkan adalah preferensi yang Anda ajukan."}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Sertifikat</div>
            <div className="mt-2 text-sm text-zinc-700">
              {booking.certificate ? (
                <a className="underline" href={`/user/certificates/${booking.certificate.id}`}>Lihat Sertifikat (QR)</a>
              ) : (
                <div className="text-zinc-600">Belum diterbitkan.</div>
              )}
            </div>
          </section>
        </>
      )}

      <div className="text-sm">
        <button className="underline" onClick={() => { router.refresh(); load(); }}>Refresh</button>
      </div>
    </div>
  );
}
