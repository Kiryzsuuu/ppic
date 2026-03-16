"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  registrationType: "PERSONAL" | "COMPANY";
  status: "PENDING" | "APPROVED" | "REJECTED";
  fullName: string;
  companyName: string | null;
  npwp: string | null;
  email: string | null;
  placeOfBirth: string | null;
  dateOfBirth: string | null;
  ktpNumber: string | null;
  phone: string | null;
  address: string | null;
  licenseNo: string | null;
  flightHours: number | null;
};

type UserInfo = {
  username: string;
  email: string | null;
} | null;

type DocumentRow = {
  id: string;
  type: "LICENSE" | "MEDICAL" | "ID" | "LOGBOOK" | "PHOTO" | "CV";
  status: "PENDING" | "APPROVED" | "REJECTED";
  fileName: string;
};

type PdfDocType = Exclude<DocumentRow["type"], "PHOTO">;

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export default function UserProfilePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userInfo, setUserInfo] = useState<UserInfo>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const photoDoc = useMemo(() => docs.find((d) => d.type === "PHOTO") ?? null, [docs]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);

  const [docType, setDocType] = useState<PdfDocType>("ID");
  const [docFile, setDocFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function load() {
    setError(null);
    setSuccess(null);
    setLoading(true);

    const [profRes, docRes] = await Promise.all([fetch("/api/profile"), fetch("/api/documents?mine=1")]);

    const profJson = (await profRes.json().catch(() => null)) as ApiRes<{ profile: Profile | null; user: UserInfo }> | null;
    if (!profRes.ok || !profJson || !profJson.ok) {
      setError(profJson && !profJson.ok ? profJson.error.message : "Gagal memuat profil");
      setLoading(false);
      return;
    }

    const docJson = (await docRes.json().catch(() => null)) as ApiRes<{ documents: DocumentRow[] }> | null;
    if (!docRes.ok || !docJson || !docJson.ok) {
      setError(docJson && !docJson.ok ? docJson.error.message : "Gagal memuat dokumen");
      setLoading(false);
      return;
    }

    setUserInfo(profJson.data.user);
    setProfile(profJson.data.profile);
    setDocs(docJson.data.documents);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      fullName: profile.fullName,
      email: profile.email && profile.email.trim() ? profile.email : null,
      phone: profile.phone ?? "",
      placeOfBirth: profile.placeOfBirth && profile.placeOfBirth.trim() ? profile.placeOfBirth : null,
      dateOfBirth: profile.dateOfBirth && profile.dateOfBirth.trim() ? profile.dateOfBirth : null,
      address: profile.address ?? "",
      ktpNumber: profile.ktpNumber && profile.ktpNumber.trim() ? profile.ktpNumber : null,
      companyName: profile.companyName && profile.companyName.trim() ? profile.companyName : null,
      npwp: profile.npwp && profile.npwp.trim() ? profile.npwp : null,
      licenseNo: profile.licenseNo && profile.licenseNo.trim() ? profile.licenseNo : undefined,
      flightHours: profile.flightHours ?? undefined,
    };

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal menyimpan profil");
      setSaving(false);
      return;
    }

    setSuccess("Profil berhasil diperbarui.");
    setSaving(false);
    await load();
  }

  async function onUploadPhoto(e: React.FormEvent) {
    e.preventDefault();
    if (!photoFile) {
      setError("Pilih file foto terlebih dahulu");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.append("type", "PHOTO");
    form.append("file", photoFile);

    const res = await fetch("/api/documents/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Upload foto gagal");
      setSaving(false);
      return;
    }

    setPhotoFile(null);
    setSuccess("Foto profil berhasil diunggah.");
    setSaving(false);
    await load();
    window.dispatchEvent(new Event("ppic:avatar-updated"));
  }

  async function onUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) {
      setError("Pilih file dokumen terlebih dahulu");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.append("type", docType);
    form.append("file", docFile);

    const res = await fetch("/api/documents/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Upload dokumen gagal");
      setSaving(false);
      return;
    }

    setDocFile(null);
    setSuccess("Dokumen berhasil diunggah.");
    setSaving(false);
    await load();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
          <p className="mt-1 text-sm text-zinc-600">Kelola data diri dan foto profil.</p>
        </div>
        <a className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/dashboard">Kembali</a>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Memuat...</div>
      ) : null}

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Foto Profil</div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
          <div className="grid gap-2">
            <div className="text-xs text-zinc-500">Saat ini</div>
            <div className="flex justify-end">
              <div className="relative h-40 w-40 overflow-hidden rounded-full border border-zinc-200 bg-white">
                {photoPreview ? (
                  <Image src={photoPreview} alt="Preview foto profil" fill unoptimized className="object-cover" />
                ) : photoDoc ? (
                  <Image
                    src={`/api/documents/${photoDoc.id}/download`}
                    alt="Foto profil"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">Belum ada foto</div>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={onUploadPhoto} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Upload Foto Baru (JPG/PNG)</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {saving ? "Mengunggah..." : "Upload Foto"}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Data Diri</div>
        <div className="mt-1 text-xs text-zinc-500">Username: {userInfo?.username ?? "-"}</div>

        {profile ? (
          <form onSubmit={onSave} className="mt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Full Name</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={profile.email ?? ""}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Phone Number</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={profile.phone ?? ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">No. KTP (NIK)</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={profile.ktpNumber ?? ""}
                  onChange={(e) => setProfile({ ...profile, ktpNumber: e.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Place of Birth</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={profile.placeOfBirth ?? ""}
                  onChange={(e) => setProfile({ ...profile, placeOfBirth: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Date of Birth</span>
                <input
                  type="date"
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={(profile.dateOfBirth ?? "").slice(0, 10)}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Address</span>
              <input
                className="h-10 rounded-lg border border-zinc-200 px-3"
                value={profile.address ?? ""}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </label>

            {profile.registrationType === "COMPANY" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Company</span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3"
                    value={profile.companyName ?? ""}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium">NPWP</span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3"
                    value={profile.npwp ?? ""}
                    onChange={(e) => setProfile({ ...profile, npwp: e.target.value })}
                  />
                </label>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">Status verifikasi: {profile.status}</div>
              <button
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 text-sm text-zinc-600">Profil tidak ditemukan.</div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Dokumen</div>
        <div className="mt-1 text-xs text-zinc-500">Dokumen PDF untuk proses verifikasi (ID, Licence, Medical). Logbook & CV opsional.</div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
          <form onSubmit={onUploadDoc} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Jenis Dokumen</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value as PdfDocType)}
              >
                <option value="ID">ID (KTP/SIM/Paspor)</option>
                <option value="LICENSE">Licence</option>
                <option value="MEDICAL">Medical</option>
                <option value="LOGBOOK">Logbook</option>
                <option value="CV">CV</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">File (PDF)</span>
              <input
                type="file"
                accept="application/pdf"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {saving ? "Mengunggah..." : "Upload Dokumen"}
            </button>
          </form>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Dokumen yang sudah diunggah</div>
            {docs.filter((d) => d.type !== "PHOTO").length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Belum ada dokumen PDF.</div>
            ) : (
              <div className="grid gap-2">
                {docs
                  .filter((d) => d.type !== "PHOTO")
                  .map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <div className="grid">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs">{d.type}</span>
                          <span className="text-xs text-zinc-700">{d.fileName}</span>
                        </div>
                        <div className="text-xs text-zinc-600">Status: <span className="font-medium">{d.status}</span></div>
                      </div>
                      <a className="text-xs underline" href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer">Download</a>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
