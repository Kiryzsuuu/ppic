import { Suspense } from "react";
import { LoginClient } from "./LoginClient";
import { getSessionFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSessionFromCookies();
  if (session) {
    if (!session.emailVerified) redirect("/verify-email");
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
          <p className="mt-1 text-sm text-zinc-600">Memuat...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
