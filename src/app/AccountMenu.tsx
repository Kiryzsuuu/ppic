"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  username: string;
  role: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR";
  photoUrl?: string | null;
};

export default function AccountMenu({ username, role, photoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  const initial = useMemo(() => (username.trim()[0] || "U").toUpperCase(), [username]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (t && popRef.current && popRef.current.contains(t)) return;
      setOpen(false);
      setConfirming(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function doLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white hover:bg-zinc-50"
        aria-label={`Menu akun: ${username} (${role})`}
        title={`${username} • ${role}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="relative h-full w-full bg-zinc-50">
          {photoUrl ? (
            <Image src={photoUrl} alt="Foto profil" fill unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-700">{initial}</div>
          )}
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
          <Link
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50"
            href="/user/profile"
            onClick={() => {
              setOpen(false);
              setConfirming(false);
            }}
          >
            Edit Profile
          </Link>

          <div className="my-2 border-t border-zinc-200" />

          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50"
            onClick={() => setConfirming(true)}
          >
            Logout
          </button>

          {confirming ? (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-medium">Apakah Anda yakin ingin logout?</div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50"
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  onClick={() => void doLogout()}
                  disabled={loading}
                >
                  {loading ? "Logout..." : "Logout"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
