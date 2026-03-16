import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";
import NotificationsWidget from "@/app/NotificationsWidget";

export default async function FinanceDashboard() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "FINANCE") redirect("/dashboard");

  const pendingPayments = await prisma.payment.findMany({
    where: { status: { in: ["PAID"] } },
    include: { booking: { include: { user: { select: { username: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const legalDocs = await prisma.legalDocument.findMany({
    orderBy: { issuedAt: "desc" },
    take: 10,
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Finance</h1>
        <p className="mt-1 text-sm text-zinc-600">Terbitkan PKS/Berita Acara dan validasi pembayaran.</p>
      </div>

      <a
        className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/finance/payments"
        aria-label="Buka modul validasi pembayaran"
      >
        <div className="text-sm font-semibold">Validasi Pembayaran</div>
        <div className="mt-3 text-sm text-zinc-600">Menunggu validasi: {pendingPayments.length}</div>
      </a>

      <a
        className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/finance/dashboard/report"
        aria-label="Buka laporan aktivitas finance"
      >
        <div className="text-sm font-semibold">Laporan</div>
        <div className="mt-2 text-sm text-zinc-600">Cetak / simpan PDF berisi grafik aktivitas (range tanggal).</div>
      </a>

      <a
        className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/finance/legal"
        aria-label="Buka modul dokumen legal"
      >
        <div className="text-sm font-semibold">Dokumen Legal (PKS / Berita Acara)</div>
        <div className="mt-2 text-sm text-zinc-600">Terbitkan dokumen legal dan buat VA.</div>
      </a>

      <NotificationsWidget title="Notifikasi Saya" compact />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Dokumen Legal Terakhir</div>
        <div className="mt-3 grid gap-2">
          {legalDocs.length === 0 ? (
            <div className="text-sm text-zinc-600">Belum ada.</div>
          ) : (
            legalDocs.map((d) => (
              <div key={d.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{d.type}</div>
                  <div className="text-xs text-zinc-600">{d.status}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">Booking: {d.bookingId}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
