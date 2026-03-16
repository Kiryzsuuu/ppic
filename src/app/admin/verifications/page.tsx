"use client";

import { useEffect, useState } from "react";

type ProfileRow = {
  id: string;
  registrationType: string;
  fullName: string;
  companyName?: string | null;
  status: string;
  user: { id: string; username: string };
  documents: { id: string; type: string; status: string; fileName: string }[];
};

type DocRow = {
  id: string;
  type: string;
  status: string;
  fileName: string;
  profile: { user: { username: string } };
};

type PendingRes = {
  profiles: ProfileRow[];
  documents: DocRow[];
  bookings: unknown[];
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function AdminVerificationsPage() {
  const [data, setData] = useState<PendingRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const docsByUser = (data?.documents ?? []).reduce<Record<string, DocRow[]>>((acc, d) => {
    const key = d.profile.user.username;
    (acc[key] ||= []).push(d);
    return acc;
  }, {});

  async function load() {
    const res = await fetch("/api/admin/pending");
    const json = (await res.json().catch(() => null)) as ApiRes<PendingRes> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat data");
      return;
    }
    setData(json.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function action(url: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(url, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Aksi gagal");
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
          <h1 className="text-2xl font-semibold tracking-tight">Verifikasi</h1>
          <p className="mt-1 text-sm text-zinc-600">Verifikasi registrasi dilakukan via OTP. Di sini admin memverifikasi dokumen.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/dashboard">Kembali</a>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Dokumen Pending</div>
        <div className="mt-4 grid gap-3">
          {!data ? (
            <div className="text-sm text-zinc-600">Loading...</div>
          ) : data.documents.length === 0 ? (
            <div className="text-sm text-zinc-600">Tidak ada dokumen pending.</div>
          ) : (
            Object.entries(docsByUser).map(([username, docs]) => (
              <div key={username} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{username}</div>
                  <div className="text-xs text-zinc-600">{docs.length} dokumen</div>
                </div>

                <div className="mt-3 grid gap-2">
                  {docs.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3">
                      <div>
                        <div className="text-sm font-medium">{d.type}</div>
                        <div className="text-xs text-zinc-600">{d.fileName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          className="inline-flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50"
                          href={`/api/documents/${d.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview
                        </a>
                        <button
                          disabled={loading}
                          onClick={() => action(`/api/admin/documents/${d.id}/approve`)}
                          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => action(`/api/admin/documents/${d.id}/reject`)}
                          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
