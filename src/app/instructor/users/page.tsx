import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type UserRow = {
  id: string;
  username: string;
  email?: string | null;
  role?: string;
  profile?: {
    fullName?: string | null;
    licenseNo?: string | null;
    phone?: string | null;
    companyName?: string | null;
    flightHours?: number | null;
  } | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !json) throw new Error("Request failed");
  return json;
}

export default async function InstructorUsersPage() {
  await requireRole(["INSTRUCTOR"]);

  const res = await fetchJson<ApiRes<{ users: UserRow[] }>>("/api/instructor/users");
  const users = res.ok ? res.data.users : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Data User Penerbang (Instructor)</h1>
        <div className="mt-1 text-sm text-zinc-600">Daftar user + biodata dasar.</div>
      </div>

      {!res.ok ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {res.error.message}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Lisensi</th>
              <th className="px-4 py-3 font-medium">Telepon</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{u.profile?.fullName ?? "-"}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">{u.email ?? "-"}</td>
                <td className="px-4 py-3">{u.profile?.licenseNo ?? "-"}</td>
                <td className="px-4 py-3">{u.profile?.phone ?? "-"}</td>
                <td className="px-4 py-3">{u.profile?.companyName ?? "-"}</td>
                <td className="px-4 py-3">{u.profile?.flightHours ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
