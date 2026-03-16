"use client";

import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  username: string;
  email?: string | null;
  role: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR";
  emailVerifiedAt?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  profile?: { fullName: string; email?: string | null; status: string } | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const byRole = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  async function load() {
    setLoading(true);
    setError(null);
    setInfo(null);
    setConfirmDeleteId(null);
    const res = await fetch("/api/admin/users?take=500");
    const json = (await res.json().catch(() => null)) as ApiRes<{ users: UserRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat user");
      setLoading(false);
      return;
    }
    setUsers(json.data.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(userId: string, role: UserRow["role"]) {
    setLoading(true);
    setError(null);
    setInfo(null);
    setConfirmDeleteId(null);
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = (await res.json().catch(() => null)) as ApiRes<unknown> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal update role");
      setLoading(false);
      return;
    }
    await load();
  }

  async function resetPassword(userId: string) {
    setLoading(true);
    setError(null);
    setInfo(null);
    setConfirmDeleteId(null);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as ApiRes<{ sent: boolean }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal reset password");
      setLoading(false);
      return;
    }
    setInfo("Link reset password sudah dikirim ke email user (jika SMTP terkonfigurasi).");
    setLoading(false);
  }

  async function deleteUser(userId: string) {
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admin/users/${userId}/delete`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as ApiRes<unknown> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal menghapus user");
      setLoading(false);
      return;
    }
    await load();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen User</h1>
          <p className="mt-1 text-sm text-zinc-600">Monitor akun, role, status verifikasi, dan aktivitas login.</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/api/admin/users/export?take=5000">
            Export CSV
          </a>
          <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">
            Kembali
          </a>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {info ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Ringkasan</div>
          <div className="text-xs text-zinc-600">
            USER: {byRole.USER ?? 0} • ADMIN: {byRole.ADMIN ?? 0} • FINANCE: {byRole.FINANCE ?? 0} • INSTRUCTOR: {byRole.INSTRUCTOR ?? 0}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">OTP</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading && users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={6}>
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-zinc-600 break-all">{u.id}</div>
                      <div className="mt-1 text-xs text-zinc-600">{u.profile?.fullName ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div>{u.email ?? u.profile?.email ?? "-"}</div>
                      <div className="text-xs text-zinc-600">Profile: {u.profile?.status ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={loading}
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as UserRow["role"])}
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="FINANCE">FINANCE</option>
                        <option value="INSTRUCTOR">INSTRUCTOR</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{u.emailVerifiedAt ? "Verified" : "Belum"}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}</div>
                      <div className="text-xs text-zinc-600">{u.lastLoginIp ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          disabled={loading}
                          onClick={() => resetPassword(u.id)}
                          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Reset Password
                        </button>
                        {confirmDeleteId === u.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs text-zinc-600">Yakin hapus <span className="font-medium">{u.username}</span>?</div>
                            <button
                              disabled={loading}
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                            >
                              Batal
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => deleteUser(u.id)}
                              className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                            >
                              Ya, Hapus
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={loading}
                            onClick={() => {
                              setError(null);
                              setInfo(null);
                              setConfirmDeleteId(u.id);
                            }}
                            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
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
