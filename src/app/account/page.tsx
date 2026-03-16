import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import LogoutButton from "@/app/account/LogoutButton";

export default async function AccountPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const initial = (session.username.trim()[0] || "U").toUpperCase();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personal Info</h1>
        <p className="mt-1 text-sm text-zinc-600">Kelola akun Anda, edit profil, dan logout.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
            {initial}
          </div>
          <div>
            <div className="text-sm font-semibold">{session.username}</div>
            <div className="text-sm text-zinc-600">Role: {session.role}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            href="/account/profile"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Edit Profile
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold">Logout</div>
        <p className="mt-1 text-sm text-zinc-600">Keluar dari aplikasi pada perangkat ini.</p>
        <div className="mt-4 max-w-sm">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
