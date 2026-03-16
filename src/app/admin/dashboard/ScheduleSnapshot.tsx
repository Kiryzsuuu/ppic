"use client";

export default function ScheduleSnapshot() {
  return (
    <a
      className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
      href="/admin/schedule"
      aria-label="Buka kalender jadwal"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Jadwal Simulator</div>
          <div className="mt-1 text-xs text-zinc-500">Tambah, ubah, dan hapus slot jadwal.</div>
        </div>
      </div>
    </a>
  );
}
