"use client";

import { useEffect, useRef, useState } from "react";

export default function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!confirming) return;
      const t = e.target as Node | null;
      if (t && boxRef.current && boxRef.current.contains(t)) return;
      setConfirming(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [confirming]);

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
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60"
        onClick={() => setConfirming(true)}
        disabled={loading}
      >
        Logout
      </button>

      <div
        className={
          "absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all duration-200 " +
          (confirming ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0")
        }
        aria-hidden={!confirming}
      >
        <div className="text-sm font-medium">Apakah Anda yakin ingin logout?</div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
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
    </div>
  );
}
