"use client";

import { useEffect, useMemo, useState } from "react";

type DocumentRow = {
  id: string;
  type: "LICENSE" | "MEDICAL" | "ID";
  fileName: string;
  mimeType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadedAt: string;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function UserDocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [type, setType] = useState<DocumentRow["type"]>("LICENSE");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusSummary = useMemo(() => {
    const map = { LICENSE: "-", MEDICAL: "-", ID: "-" } as Record<string, string>;
    for (const d of docs) map[d.type] = d.status;
    return map;
  }, [docs]);

  async function load() {
    const res = await fetch("/api/documents");
    const json = (await res.json().catch(() => null)) as ApiRes<{ documents: DocumentRow[] }> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat dokumen");
      return;
    }
    setDocs(json.data.documents);
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Pilih file terlebih dahulu");
      return;
    }

    setLoading(true);
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);

    const res = await fetch("/api/documents/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Upload gagal");
      setLoading(false);
      return;
    }

    setFile(null);
    await load();
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dokumen</h1>
        <p className="mt-1 text-sm text-zinc-600">Upload dan kelola dokumen lisensi, sertifikat medis, dan identitas.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Ringkasan Status</div>
        <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
          {(["LICENSE", "MEDICAL", "ID"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-600">{k}</div>
              <div className="mt-1 text-sm font-semibold">{statusSummary[k]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Upload Dokumen</div>
        <form onSubmit={onUpload} className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Jenis Dokumen</span>
            <select
              className="h-10 rounded-lg border border-zinc-200 px-3"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentRow["type"])}
            >
              <option value="LICENSE">License</option>
              <option value="MEDICAL">Medical Certificate</option>
              <option value="ID">KTP/Paspor</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">File (PDF/JPG/PNG)</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button disabled={loading} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-3">
            {loading ? "Mengunggah..." : "Upload"}
          </button>
        </form>

        {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Daftar Dokumen</div>
        <div className="mt-4 grid gap-2">
          {docs.length === 0 ? (
            <div className="text-sm text-zinc-600">Belum ada dokumen.</div>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-4">
                <div>
                  <div className="text-sm font-medium">{d.type}</div>
                  <div className="text-xs text-zinc-600">{d.fileName}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-zinc-600">{d.status}</div>
                  <a className="rounded-lg border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50" href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="text-sm">
        <a className="underline" href="/user/dashboard">Kembali ke Dashboard</a>
      </div>
    </div>
  );
}
