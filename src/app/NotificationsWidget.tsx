"use client";

import { useEffect, useMemo, useState } from "react";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationsRes = {
  unreadCount: number;
  notifications: NotificationRow[];
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

function fmt(dt: string) {
  const d = new Date(dt);
  return Number.isFinite(d.getTime()) ? dateTimeFormatter.format(d) : dt;
}

export default function NotificationsWidget(props: { title?: string; compact?: boolean }) {
  const title = props.title ?? "Notifikasi";
  const [data, setData] = useState<NotificationsRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as ApiRes<NotificationsRes> | null;
    if (!res.ok || !json || !json.ok) {
      setError(json && !json.ok ? json.error.message : "Gagal memuat notifikasi");
      setLoading(false);
      return;
    }
    setData(json.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    const prev = data;
    setData((cur) => {
      if (!cur) return cur;
      return {
        unreadCount: Math.max(0, cur.unreadCount - (cur.notifications.find((n) => n.id === id && !n.readAt) ? 1 : 0)),
        notifications: cur.notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
      };
    });

    const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setData(prev ?? null);
      setError(json?.error?.message ?? "Gagal menandai notifikasi");
    }
  }

  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-0 text-sm font-semibold truncate">{title}</div>
          <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">{unreadCount} belum dibaca</div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className={props.compact ? "mt-3 grid gap-2" : "mt-4 grid gap-3"}>
        {loading && !data ? <div className="text-sm text-zinc-600">Loading...</div> : null}
        {!loading && data && list.length === 0 ? <div className="text-sm text-zinc-600">Belum ada notifikasi.</div> : null}

        {list.slice(0, props.compact ? 8 : 12).map((n) => (
          <div key={n.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 font-medium truncate">{n.title}</div>
                  {n.readAt ? (
                    <div className="text-xs text-zinc-500">Dibaca</div>
                  ) : (
                    <div className="text-xs font-medium text-zinc-900">Baru</div>
                  )}
                </div>
                <div className="mt-1 break-words text-sm text-zinc-600">{n.body}</div>
                <div className="mt-2 text-xs text-zinc-500">{fmt(n.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                {!n.readAt ? (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
                  >
                    Tandai dibaca
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
