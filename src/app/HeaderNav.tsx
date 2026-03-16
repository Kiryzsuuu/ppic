"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  username: string;
  role: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR";
} | null;

export default function HeaderNav({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();

  const close = () => setOpen(false);

  async function refreshAvatar() {
    if (!session) return;
    const res = await fetch("/api/me");
    const json = (await res.json().catch(() => null)) as
      | { ok: true; data: { avatarUrl: string | null } }
      | { ok: false; error: { message: string } }
      | null;
    if (!res.ok || !json || !json.ok) return;
    setAvatarUrl(json.data.avatarUrl ?? null);
  }

  useEffect(() => {
    if (!session) return;
    refreshAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username, session?.role, pathname]);

  useEffect(() => {
    if (!session) return;
    function onAvatarUpdated() {
      refreshAvatar();
    }
    window.addEventListener("ppic:avatar-updated", onAvatarUpdated);
    return () => window.removeEventListener("ppic:avatar-updated", onAvatarUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username, session?.role]);

  return (
    <div className="flex shrink-0 items-center gap-3">
      {/* Desktop nav */}
      <nav className="hidden items-center gap-3 text-sm md:flex">
        <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/" prefetch>
          Home
        </Link>
        <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/dashboard" prefetch>
          Dashboard
        </Link>

        {session ? null : (
          <>
            <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/login" prefetch>
              Login
            </Link>
            <Link className="rounded-md bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800" href="/register" prefetch>
              Register
            </Link>
          </>
        )}
      </nav>

      {session ? (
        <Link
          href="/account"
          className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white transition hover:bg-zinc-50 hover:scale-105 active:scale-100"
          aria-label={`Personal info: ${session.username} (${session.role})`}
          title={`${session.username} • ${session.role}`}
        >
          {avatarUrl ? (
            <div className="relative h-full w-full bg-zinc-50">
              <Image src={avatarUrl} alt="Foto profil" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <span className="text-sm font-semibold text-zinc-700">
              {(session.username.trim()[0] || "U").toUpperCase()}
            </span>
          )}
        </Link>
      ) : null}

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Mobile menu */}
      {open ? (
        <div className="absolute left-0 right-0 top-[60px] z-50 border-b border-zinc-200 bg-white md:hidden">
          <div className="mx-auto grid max-w-6xl gap-1 px-4 py-3 text-sm">
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-50" href="/" onClick={close}>
              Home
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-50" href="/dashboard" onClick={close}>
              Dashboard
            </Link>

            {session ? null : (
              <>
                <Link className="rounded-lg px-3 py-2 hover:bg-zinc-50" href="/login" onClick={close}>
                  Login
                </Link>
                <Link className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800" href="/register" onClick={close}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
