import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";
import NotificationsWidget from "@/app/NotificationsWidget";

export default async function InstructorDashboard() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "INSTRUCTOR") redirect("/dashboard");

  const upcoming = await prisma.booking.findMany({
    where: {
      leaseType: "WET",
      status: { in: ["CONFIRMED"] },
      slot: { isNot: null },
    },
    include: { user: { select: { username: true } }, simulator: true, slot: true },
    orderBy: { requestedAt: "desc" },
    take: 20,
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Instructor</h1>
        <p className="mt-1 text-sm text-zinc-600">Pantau jadwal Wet Leased dan isi logbook.</p>
      </div>

      <a
        className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        href="/instructor/logbook"
        aria-label="Buka modul logbook"
      >
        <div className="text-sm font-semibold">Jadwal Wet Leased</div>
        <div className="mt-3 grid gap-2">
          {upcoming.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada jadwal.</div>
          ) : (
            upcoming.map((b) => (
              <div key={b.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{b.user.username}</div>
                  <div className="text-xs text-zinc-600">{b.simulator.category} {b.simulator.name}</div>
                </div>
                <div className="mt-1 text-sm text-zinc-600">{b.trainingName}</div>
                <div className="mt-2 text-xs text-zinc-600">
                  {b.slot ? `${new Date(b.slot.startAt).toLocaleString()} - ${new Date(b.slot.endAt).toLocaleString()}` : "-"}
                </div>
              </div>
            ))
          )}
        </div>
      </a>

      <NotificationsWidget title="Notifikasi Saya" compact />
    </div>
  );
}
