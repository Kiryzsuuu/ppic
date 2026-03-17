import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type Slot = {
  id: string;
  simulatorId: string;
  startAt: string;
  endAt: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED";
  simulator?: { id: string; name: string } | null;
  booking?: {
    id: string;
    user?: { id: string; username: string; email?: string | null; profile?: { fullName: string } | null } | null;
  } | null;
};

type UserLite = {
  id: string;
  username: string;
  email?: string | null;
  profile?: { fullName: string } | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !json) throw new Error("Request failed");
  return json;
}

function toLocal(dateIso: string) {
  const dt = new Date(dateIso);
  return dt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InstructorSchedulePage() {
  await requireRole(["INSTRUCTOR"]);

  const [slotsRes, usersRes] = await Promise.all([
    fetchJson<ApiRes<{ slots: Slot[] }>>("/api/instructor/slots"),
    fetchJson<ApiRes<{ users: UserLite[] }>>("/api/instructor/users"),
  ]);

  const slots = slotsRes.ok ? slotsRes.data.slots : [];
  const users = usersRes.ok ? usersRes.data.users : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Jadwal Simulator (Instructor)</h1>
          <div className="mt-1 text-sm text-zinc-600">Booking slot WET untuk user dari daftar slot.</div>
        </div>
      </div>

      {!slotsRes.ok ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {slotsRes.error.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {slots.map((s) => (
          <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{s.simulator?.name ?? "Simulator"}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {toLocal(s.startAt)} – {toLocal(s.endAt)} WIB
                </div>
              </div>
              <div className="text-xs">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-1 font-medium " +
                    (s.status === "AVAILABLE"
                      ? "bg-emerald-50 text-emerald-700"
                      : s.status === "BOOKED"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-zinc-100 text-zinc-700")
                  }
                >
                  {s.status}
                </span>
              </div>
            </div>

            {s.status === "BOOKED" && s.booking?.user ? (
              <div className="mt-3 text-sm text-zinc-700">
                Booked untuk: <span className="font-medium">{s.booking.user.profile?.fullName ?? s.booking.user.username}</span>
                {s.booking.user.email ? <span className="text-zinc-500"> ({s.booking.user.email})</span> : null}
              </div>
            ) : null}

            {s.status === "AVAILABLE" ? (
              <form
                className="mt-4 grid gap-3 md:grid-cols-5 md:items-end"
                action={async (formData) => {
                  "use server";
                  await requireRole(["INSTRUCTOR"]);

                  const userId = String(formData.get("userId") ?? "");
                  const trainingCode = String(formData.get("trainingCode") ?? "PPC");
                  const trainingName = String(formData.get("trainingName") ?? "").trim();
                  const personCountRaw = Number(formData.get("personCount") ?? 1);
                  const personCount = personCountRaw === 2 ? 2 : 1;

                  if (!userId || !trainingName) return;

                  await fetch(`/api/instructor/slots/${encodeURIComponent(s.id)}/book`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ userId, personCount, trainingCode, trainingName }),
                  });

                  redirect("/instructor/schedule");
                }}
              >
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-medium">User</span>
                  <select name="userId" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" defaultValue="">
                    <option value="" disabled>
                      Pilih user
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.profile?.fullName ? `${u.profile.fullName} — ` : ""}
                        {u.username}
                        {u.email ? ` (${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Person</span>
                  <select name="personCount" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" defaultValue="1">
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Training</span>
                  <select name="trainingCode" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" defaultValue="PPC">
                    <option value="PPC">PPC</option>
                    <option value="TYPE_RATING">Type Rating</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm md:col-span-4">
                  <span className="font-medium">Training Name</span>
                  <input
                    name="trainingName"
                    className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                    defaultValue="Pilot Proficiency Training (PPC)"
                  />
                </label>

                <button className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 md:col-span-1">
                  Booking
                </button>

                <div className="text-xs text-zinc-500 md:col-span-5">
                  Setelah submit, refresh halaman untuk melihat perubahan status slot.
                </div>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
