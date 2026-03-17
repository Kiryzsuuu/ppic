import { requireRole } from "@/lib/rbac";
import { getWetSessionKeyForRange } from "@/lib/schedule";
import StaffBookingForm from "./StaffBookingForm";

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

type Simulator = { id: string; category: string; name: string };

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

  const [slotsRes, usersRes, simsRes] = await Promise.all([
    fetchJson<ApiRes<{ slots: Slot[] }>>("/api/instructor/slots"),
    fetchJson<ApiRes<{ users: UserLite[] }>>("/api/instructor/users"),
    fetchJson<ApiRes<{ simulators: Simulator[] }>>("/api/simulators"),
  ]);

  const slots = slotsRes.ok ? slotsRes.data.slots : [];
  const users = usersRes.ok ? usersRes.data.users : [];
  const simulators = simsRes.ok ? simsRes.data.simulators : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Jadwal Simulator (Instructor)</h1>
          <div className="mt-1 text-sm text-zinc-600">Booking staff (WET/DRY) langsung CONFIRMED untuk user.</div>
        </div>
      </div>

      {usersRes.ok && simsRes.ok ? (
        <div className="mt-6">
          <StaffBookingForm users={users} simulators={simulators} />
        </div>
      ) : null}

      {!slotsRes.ok ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {slotsRes.error.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {slots.map((s) => {
          const isSession = !!getWetSessionKeyForRange(new Date(s.startAt), new Date(s.endAt));

          return (
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

            {s.status === "AVAILABLE" && !isSession ? (
              <div className="mt-3 text-sm text-amber-700">Slot ini bukan sesi WET, jadi tidak bisa dibooking.</div>
            ) : null}

            {s.status === "AVAILABLE" && isSession ? (
              <div className="mt-3 text-xs text-zinc-500">
                Slot sesi WET tersedia. Gunakan form booking di atas untuk membuat booking.
              </div>
            ) : null}

            </div>
          );
        })}
      </div>
    </div>
  );
}
