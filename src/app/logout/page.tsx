"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    })();
  }, [router]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
      Logout...
    </div>
  );
}
