"use client";

import { useEffect, useState } from "react";

type PaymentRow = {
  id: string;
  amount: number;
  vaNumber: string;
  status: string;
  paidAt?: string | null;
  proofFileName?: string | null;
  proofMimeType?: string | null;
  proofStoragePath?: string | null;
  booking: {
    id: string;
    user: { username: string };
    simulator: { category: string; name: string };
  };
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function FinancePaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/finance/payments");
    const json = (await res.json().catch(() => null)) as ApiRes<{ payments: PaymentRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat data");
      return;
    }
    setPayments(json.data.payments);
  }

  useEffect(() => {
    load();
  }, []);

  async function validate(id: string, approve: boolean) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/finance/payments/${id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal validasi");
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
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Pembayaran</h1>
          <p className="mt-1 text-sm text-zinc-600">Validasi pembayaran yang sudah ditandai PAID oleh user.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/finance/dashboard">Kembali</a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Menunggu Validasi</div>
        <div className="mt-4 grid gap-2">
          {payments.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada.</div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{p.booking.user.username}</div>
                  <div className="text-xs text-zinc-600">VA: {p.vaNumber}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">{p.booking.simulator.category} {p.booking.simulator.name}</div>
                <div className="mt-2 text-sm text-zinc-700">Nominal: Rp {p.amount.toLocaleString()}</div>

                <div className="mt-2 text-xs text-zinc-600">
                  Bukti bayar: {p.proofStoragePath ? (
                    <a className="underline" href={`/api/finance/payments/${p.id}/proof`} target="_blank" rel="noreferrer">Preview</a>
                  ) : (
                    <span>-</span>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button disabled={loading} onClick={() => validate(p.id, true)} className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">Approve</button>
                  <button disabled={loading} onClick={() => validate(p.id, false)} className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
