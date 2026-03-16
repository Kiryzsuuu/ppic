import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";
import EmailVerificationPanel from "@/app/user/dashboard/EmailVerificationPanel";
import NotificationsWidget from "@/app/NotificationsWidget";

export default async function UserDashboard() {
  const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });

  function fmtDateTime(dt: string | Date) {
    const d = typeof dt === "string" ? new Date(dt) : dt;
    return Number.isFinite(d.getTime()) ? dateTimeFormatter.format(d) : String(dt);
  }

  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerifiedAt: true },
  });

  const bookings = await prisma.booking.findMany({
    where: { userId: session.userId },
    include: { simulator: true, payment: true, slot: true, certificate: true },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard User</h1>
        <p className="mt-1 text-sm text-zinc-600">Halo, <span className="font-medium">{session.username}</span>. Pantau status verifikasi dan riwayat booking.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Status Verifikasi</div>
            <div className="mt-1 text-sm text-zinc-600">Profil: <span className="font-medium">{profile?.status ?? "-"}</span></div>
          </div>
          <a className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800" href="/user/booking/new">Buat Booking</a>
        </div>

        <EmailVerificationPanel
          email={user?.email ?? null}
          emailVerifiedAt={user?.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null}
        />
      </section>

      <NotificationsWidget />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Catatan Booking</div>
        <div className="mt-2 grid gap-1 text-sm text-zinc-600">
          <div>- Upload dokumen dilakukan di menu Edit Profil.</div>
          <div>- Jadwal final mengikuti proses verifikasi & pembayaran.</div>
          <div>- Pastikan data diri dan dokumen valid agar proses cepat.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Booking Terakhir</div>
        <div className="mt-3 grid gap-2">
          {bookings.length === 0 ? (
            <div className="text-sm text-zinc-600">Belum ada booking.</div>
          ) : (
            bookings.map((b) => (
              <a key={b.id} className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50" href={`/user/bookings/${b.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{b.simulator.category} {b.simulator.name}</div>
                  <div className="text-xs text-zinc-600">Status: <span className="font-medium">{b.status}</span></div>
                </div>
                <div className="mt-1 text-sm text-zinc-600">{b.leaseType} • {b.trainingName}</div>
                <div className="mt-2 grid gap-1 text-xs text-zinc-600">
                  <div>Pembayaran: {b.payment?.status ?? "-"} (VA: {b.payment?.vaNumber ?? "-"})</div>
                  <div>
                    Jadwal: {b.slot
                      ? `${fmtDateTime(b.slot.startAt)} - ${fmtDateTime(b.slot.endAt)}`
                      : b.requestedStartAt && b.requestedEndAt
                        ? `${fmtDateTime(b.requestedStartAt)} - ${fmtDateTime(b.requestedEndAt)}`
                        : "Belum diisi"}
                  </div>
                  <div>Sertifikat: {b.certificate ? "Tersedia" : "-"}</div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
