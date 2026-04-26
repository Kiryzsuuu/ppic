"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Simulator = { id: string; category: "AIRBUS" | "BOEING"; name: string };
type LeaseType = "WET" | "DRY";
type DeviceType = "FFS" | "FTD";
type PaymentMethod = "QRIS" | "TRANSFER";
type WetTraining = "PPC" | "TYPE_RATING" | "DIFFERENCES" | "OTHER";
type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  status: "AVAILABLE" | "BOOKED" | "LOCKED";
  leaseType: "WET" | "DRY";
  simulator: { category: string; name: string };
};

const DRY_HOURS_PER_PERSON = 1;

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default function LeaseBookingPage() {
  const router = useRouter();
  const [simulators, setSimulators] = useState<Simulator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 0: Lease config
  const [simulatorId, setSimulatorId] = useState("");
  const [leaseType, setLeaseType] = useState<LeaseType>("WET");
  const [wetTraining, setWetTraining] = useState<WetTraining>("PPC");
  const [personCount, setPersonCount] = useState<1 | 2>(2);
  const [deviceType, setDeviceType] = useState<DeviceType | "">("");

  // Step 1: Schedule
  const [requestedDate, setRequestedDate] = useState("");
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [institutionName, setInstitutionName] = useState("");
  const [selectedWetSlot, setSelectedWetSlot] = useState<Slot | null>(null);
  const [availableWetSlots, setAvailableWetSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 2: Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRIS");

  const selectedSimulator = useMemo(() => simulators.find((s) => s.id === simulatorId) ?? null, [simulators, simulatorId]);
  const differencesAllowed = selectedSimulator?.category === "BOEING";

  useEffect(() => {
    fetch("/api/simulators").then((r) => r.json()).then((j) => {
      if (j?.ok) {
        setSimulators(j.data.simulators);
        if (j.data.simulators.length > 0) setSimulatorId(j.data.simulators[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!differencesAllowed && wetTraining === "DIFFERENCES") setWetTraining("PPC");
  }, [differencesAllowed, wetTraining]);

  // Fetch WET slots for selected date
  useEffect(() => {
    if (leaseType !== "WET" || !requestedDate || !simulatorId) {
      setAvailableWetSlots([]);
      setSelectedWetSlot(null);
      return;
    }

    const loadSlots = async () => {
      setLoadingSlots(true);
      const dateStart = new Date(`${requestedDate}T00:00:00`);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);

      const from = dateStart.toISOString();
      const to = dateEnd.toISOString();

      try {
        const res = await fetch(`/api/public/slots?simulatorId=${encodeURIComponent(simulatorId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        const json = await res.json();
        if (res.ok && json?.ok) {
          const slots = (json.data.slots || []).filter((s: Slot) => s.leaseType === "WET");
          setAvailableWetSlots(slots);
          setSelectedWetSlot(null);
        }
      } catch (e) {
        console.error("Failed to load slots", e);
      }
      setLoadingSlots(false);
    };

    loadSlots();
  }, [leaseType, requestedDate, simulatorId]);

  function toggleHour(h: number) {
    setSelectedHours((prev) => {
      if (prev.includes(h)) {
        return prev.filter((x) => x !== h);
      }
      const next = [...prev, h].sort((a, b) => a - b);
      const min = next[0];
      const max = next[next.length - 1];
      const range: number[] = [];
      for (let i = min; i <= max; i++) range.push(i);
      return range;
    });
  }

  const requestedStartAt = useMemo(() => {
    if (!requestedDate) return "";
    if (leaseType === "WET") {
      if (!selectedWetSlot) return "";
      return selectedWetSlot.startAt;
    }
    if (selectedHours.length === 0) return "";
    const h = Math.min(...selectedHours);
    return `${requestedDate}T${pad2(h)}:00`;
  }, [requestedDate, selectedHours, leaseType, selectedWetSlot]);

  const requestedEndAt = useMemo(() => {
    if (!requestedDate) return "";
    if (leaseType === "WET") {
      if (!selectedWetSlot) return "";
      return selectedWetSlot.endAt;
    }
    if (selectedHours.length === 0) return "";
    const h = Math.max(...selectedHours) + 1;
    if (h >= 24) return `${requestedDate}T23:59`;
    return `${requestedDate}T${pad2(h)}:00`;
  }, [requestedDate, selectedHours, leaseType, selectedWetSlot]);

  const wetTrainingName = useMemo(() => {
    if (wetTraining === "PPC") return "Pilot Proficiency Training (PPC)";
    if (wetTraining === "TYPE_RATING") return "Initial Type Rating";
    if (wetTraining === "DIFFERENCES") return "Differences";
    return "Other";
  }, [wetTraining]);

  const trainingCodeForApi = useMemo(() => {
    if (wetTraining === "PPC") return "PPC";
    if (wetTraining === "TYPE_RATING") return "TYPE_RATING";
    if (wetTraining === "DIFFERENCES") return "DIFFERENCES";
    return "OTHER";
  }, [wetTraining]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!simulatorId) { setError("Pilih simulator"); return; }
    if (leaseType === "DRY" && !deviceType) { setError("Pilih device type"); return; }
    if (leaseType === "WET" && !requestedDate) { setError("Pilih tanggal"); return; }
    if (leaseType === "WET" && !selectedWetSlot) { setError("Pilih jam yang tersedia"); return; }
    if (leaseType === "DRY" && (!requestedStartAt || !requestedEndAt)) { setError("Pilih tanggal dan jam"); return; }
    if (leaseType === "DRY" && selectedHours.length < DRY_HOURS_PER_PERSON) {
      setError(`Minimal ${DRY_HOURS_PER_PERSON} jam untuk Dry Leased`);
      return;
    }

    setLoading(true);
    try {
      const body: any = {
        simulatorId,
        bookingType: "LEASE",
        leaseType,
        trainingCode: leaseType === "WET" ? trainingCodeForApi : "OTHER",
        trainingName: leaseType === "WET" ? wetTrainingName : `Dry Leased (${deviceType})`,
        personCount: leaseType === "WET" ? personCount : 1,
        paymentMethod,
        institutionName: institutionName.trim() || undefined,
      };

      if (leaseType === "DRY") {
        body.deviceType = deviceType;
        body.requestedStartAt = new Date(requestedStartAt).toISOString();
        if (requestedEndAt) {
          body.requestedEndAt = new Date(requestedEndAt).toISOString();
        }
      } else {
        body.requestedStartAt = new Date(requestedStartAt).toISOString();
        body.requestedEndAt = new Date(requestedEndAt).toISOString();
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error?.message ?? "Gagal membuat booking"); setLoading(false); return; }

      const bookingId = json.data.booking.id as string;
      await fetch(`/api/bookings/${bookingId}/submit`, { method: "POST" }).catch(() => null);
      router.push(`/user/bookings/${bookingId}`);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const steps = ["Konfigurasi Lease", "Pilih Jadwal", "Pembayaran"];

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Booking Lease Simulator</h1>
        <p className="mt-1 text-sm text-zinc-600">Sewa simulator per jam (Wet / Dry Leased).</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${step >= i ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500"}`}>{i + 1}</div>
            <span className={`text-sm ${step === i ? "font-medium text-zinc-900" : "text-zinc-500"}`}>{s}</span>
            {i < steps.length - 1 && <div className="flex-1 border-t border-zinc-200" />}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
        {/* Step 0: Lease Config */}
        {step === 0 && (
          <div className="grid gap-4">
            <div className="text-base font-semibold">Konfigurasi Lease</div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Simulator</span>
                <select className="h-10 rounded-lg border border-zinc-200 px-3" value={simulatorId} onChange={(e) => setSimulatorId(e.target.value)}>
                  {simulators.map((s) => <option key={s.id} value={s.id}>{s.category} {s.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Jenis Lease</span>
                <select className="h-10 rounded-lg border border-zinc-200 px-3" value={leaseType} onChange={(e) => setLeaseType(e.target.value as LeaseType)}>
                  <option value="WET">Wet Leased (dengan instruktur)</option>
                  <option value="DRY">Dry Leased (tanpa instruktur)</option>
                </select>
              </label>
            </div>

            {leaseType === "WET" && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Jenis Training</span>
                  <select className="h-10 rounded-lg border border-zinc-200 px-3" value={wetTraining} onChange={(e) => setWetTraining(e.target.value as WetTraining)}>
                    <option value="PPC">Pilot Proficiency Training (PPC)</option>
                    <option value="TYPE_RATING">Initial Type Rating</option>
                    {differencesAllowed && <option value="DIFFERENCES">Differences</option>}
                    <option value="OTHER">Lainnya</option>
                  </select>
                  {!differencesAllowed && <span className="text-xs text-zinc-500">Differences hanya untuk Boeing.</span>}
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Jumlah Peserta</span>
                  <select className="h-10 rounded-lg border border-zinc-200 px-3" value={personCount} onChange={(e) => setPersonCount(Number(e.target.value) as 1 | 2)}>
                    <option value={1}>1 Orang</option>
                    <option value={2}>2 Orang</option>
                  </select>
                  <span className="text-xs text-zinc-500">Wet Leased: Jadwal ditentukan admin. Minimum 2 orang per sesi.</span>
                </label>
              </div>
            )}

            {leaseType === "DRY" && (
              <label className="grid gap-1 text-sm md:max-w-xs">
                <span className="font-medium">Device Type</span>
                <select className="h-10 rounded-lg border border-zinc-200 px-3" value={deviceType} onChange={(e) => setDeviceType(e.target.value as DeviceType)}>
                  <option value="" disabled>Pilih device...</option>
                  <option value="FFS">Full Flight Simulator (FFS)</option>
                  <option value="FTD">Flight Training Device (FTD)</option>
                </select>
                <span className="text-xs text-zinc-500">Dry Leased: 1 jam/orang.</span>
              </label>
            )}

            <label className="grid gap-1 text-sm md:max-w-xs">
              <span className="font-medium">Instansi / Maskapai (opsional)</span>
              <input className="h-10 rounded-lg border border-zinc-200 px-3" placeholder="Contoh: Garuda Indonesia" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
            </label>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
              <div className="font-medium">Ringkasan</div>
              <div>Simulator: {selectedSimulator ? `${selectedSimulator.category} ${selectedSimulator.name}` : "-"}</div>
              <div>Lease: {leaseType === "WET" ? "Wet Leased" : "Dry Leased"}</div>
              {leaseType === "WET" && <><div>Training: {wetTrainingName}</div><div>Peserta: {personCount} orang → per jam (admin assign)</div></>}
              {leaseType === "DRY" && <div>Device: {deviceType || "-"} → {DRY_HOURS_PER_PERSON} jam/orang</div>}
            </div>
          </div>
        )}

        {/* Step 1: Schedule */}
        {step === 1 && (
          <div className="grid gap-4">
            <div className="text-base font-semibold">Pilih Jadwal</div>

            {leaseType === "WET" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <strong>Wet Leased:</strong> Pilih tanggal dan jam yang tersedia.
              </div>
            )}

            {leaseType === "DRY" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Dry Leased: pilih tanggal dan jam sesuai kebutuhan ({DRY_HOURS_PER_PERSON} jam/orang minimum).
              </div>
            )}

            <label className="grid gap-1 text-sm md:max-w-xs">
              <span className="font-medium">Tanggal {leaseType === "WET" ? "" : ""}</span>
              <input type="date" className="h-10 rounded-lg border border-zinc-200 bg-white px-3" value={requestedDate}
                onChange={(e) => { setRequestedDate(e.target.value); if (leaseType === "DRY") setSelectedHours([]); setSelectedWetSlot(null); }} />
            </label>

            {requestedDate && leaseType === "WET" && (
              <div className="grid gap-3">
                <div className="text-sm font-medium">Pilih Jam</div>
                {loadingSlots ? (
                  <div className="text-sm text-zinc-600">Memuat jadwal tersedia...</div>
                ) : availableWetSlots.length === 0 ? (
                  <div className="text-sm text-zinc-600">Tidak ada jadwal tersedia untuk tanggal ini.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {availableWetSlots.map((slot) => {
                      const startTime = new Date(slot.startAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
                      const endTime = new Date(slot.endAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
                      const isSelected = selectedWetSlot?.id === slot.id;
                      const isAvailable = slot.status === "AVAILABLE";
                      const buttonClass = isSelected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : isAvailable
                          ? "border-emerald-500 bg-white text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          : "border-red-200 bg-red-50 text-red-700 cursor-not-allowed opacity-60";
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && setSelectedWetSlot(slot)}
                          className={`h-14 rounded-lg border text-sm font-medium transition ${buttonClass}`}
                          title={slot.status === "AVAILABLE" ? "Tersedia" : "Tidak tersedia"}
                        >
                          <div>{startTime}</div>
                          <div className="text-xs">–{endTime}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedWetSlot && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    Dipilih: {new Date(selectedWetSlot.startAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })} – {new Date(selectedWetSlot.endAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}
                  </div>
                )}
              </div>
            )}

            {requestedDate && leaseType === "DRY" && (
              <div className="grid gap-2">
                <div className="text-sm font-medium">Pilih Jam</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {Array.from({ length: 24 }, (_, h) => {
                    const isSelected = selectedHours.includes(h);
                    return (
                      <button key={h} type="button"
                        onClick={() => toggleHour(h)}
                        className={`h-10 rounded-lg border text-xs font-medium transition ${isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                        {pad2(h)}:00
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-zinc-500">
                  Klik jam untuk memilih/batal. Pilih beberapa jam secara berurutan.
                </div>
                {selectedHours.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                    Dipilih: {pad2(Math.min(...selectedHours))}:00 – {pad2(Math.max(...selectedHours) + 1)}:00 ({selectedHours.length} jam)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div className="grid gap-4">
            <div className="text-base font-semibold">Metode Pembayaran</div>
            <label className="grid gap-1 text-sm md:max-w-xs">
              <span className="font-medium">Pilih Metode</span>
              <select className="h-10 rounded-lg border border-zinc-200 px-3" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="QRIS">QRIS</option>
                <option value="TRANSFER">Transfer Bank</option>
              </select>
            </label>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
              <div className="font-medium">Ringkasan Booking</div>
              <div>Simulator: {selectedSimulator ? `${selectedSimulator.category} ${selectedSimulator.name}` : "-"}</div>
              <div>Lease: {leaseType === "WET" ? "Wet Leased" : "Dry Leased"}</div>
              {leaseType === "WET" && <div>Training: {wetTrainingName} • {personCount} orang</div>}
              {leaseType === "DRY" && <div>Device: {deviceType}</div>}
              <div>Jadwal: {leaseType === "WET"
                ? selectedWetSlot
                  ? `${requestedDate} ${new Date(selectedWetSlot.startAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })} – ${new Date(selectedWetSlot.endAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}`
                  : `${requestedDate} (pilih jam terlebih dahulu)`
                : `${requestedDate} ${pad2(Math.min(...(selectedHours.length ? selectedHours : [0])))}:00 – ${pad2(Math.max(...(selectedHours.length ? selectedHours : [0])) + 1)}:00`}</div>
              {institutionName && <div>Instansi: {institutionName}</div>}
            </div>
            {leaseType === "WET" && personCount === 1 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ Sesi ini baru 1 peserta. Minimum 2 orang per sesi. Anda akan mendapat notifikasi jika sesi belum terpenuhi dan akan di-hold selama 1 minggu.
              </div>
            )}
          </div>
        )}

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex items-center justify-between gap-3">
          <a className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50" href="/user/dashboard">Batal</a>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                Kembali
              </button>
            )}
            {step < 2 ? (
              <button type="button" onClick={() => {
                setError(null);
                if (step === 0) {
                  if (!simulatorId) { setError("Pilih simulator"); return; }
                  if (leaseType === "DRY" && !deviceType) { setError("Pilih device type"); return; }
                }
                if (step === 1) {
                  if (!requestedDate) { setError("Pilih tanggal"); return; }
                  if (leaseType === "DRY" && selectedHours.length < DRY_HOURS_PER_PERSON) { setError(`Minimal ${DRY_HOURS_PER_PERSON} jam`); return; }
                }
                setStep((s) => (s + 1) as 0 | 1 | 2);
              }} className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                Lanjut
              </button>
            ) : (
              <button disabled={loading} className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
                {loading ? "Menyimpan..." : "Konfirmasi Booking"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
