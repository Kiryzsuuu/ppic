import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";

function fmt(dt: Date) {
  const s = dt.toISOString();
  return s.replace("T", " ").slice(0, 19);
}

export default async function AdminLogsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { username: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="mt-1 text-sm text-zinc-600">Catatan aktivitas sistem dan staff (terbaru dulu).</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">
            Kembali
          </a>
          <a
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            href="/api/admin/logs/export?take=2000"
          >
            Export CSV
          </a>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={6}>
                    Belum ada log.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700">{fmt(l.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{l.action}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.actor?.username ?? "-"}</div>
                      <div className="text-xs text-zinc-600 break-all">{l.actorId ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{l.actorRole ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-700">{l.targetType ?? "-"}</div>
                      <div className="text-xs text-zinc-600 break-all">{l.targetId ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{l.ip ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
