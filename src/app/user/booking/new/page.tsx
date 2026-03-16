"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Simulator = {
  id: string;
  category: "AIRBUS" | "BOEING";
  name: string;
};

type Profile = {
  registrationType: "PERSONAL" | "COMPANY";
  status: "PENDING" | "APPROVED" | "REJECTED";
  fullName: string;
  companyName: string | null;
  email: string | null;
  npwp: string | null;
  licenseNo: string | null;
  flightHours: number | null;
  phone: string | null;
  address: string | null;
};

type ApiRes<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type WizardStep = 0 | 1 | 2;
type LeaseType = "WET" | "DRY";
type WetTraining = "PPC" | "TYPE_RATING" | "DIFFERENCES";
type DeviceType = "FFS" | "FTD";
type PaymentMethod = "QRIS" | "TRANSFER";

export default function NewBookingPage() {
  const router = useRouter();

  const [simulators, setSimulators] = useState<Simulator[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<WizardStep>(0);

  const [simulatorId, setSimulatorId] = useState("");
  const [leaseType, setLeaseType] = useState<LeaseType>("WET");

  // WET flow
  const [wetTraining, setWetTraining] = useState<WetTraining>("PPC");
  const [personCount, setPersonCount] = useState<1 | 2>(1);

  // DRY flow
  const [deviceType, setDeviceType] = useState<DeviceType | "">("");
  const [registrationTypeChoice, setRegistrationTypeChoice] = useState<"PERSONAL" | "COMPANY">("PERSONAL");

  // Step 2: Personal info + uploads (mostly for WET)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [npwp, setNpwp] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [address, setAddress] = useState("");
  const [flightHours, setFlightHours] = useState<string>("");

  const [idScanFile, setIdScanFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const [logbookFile, setLogbookFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  // User-proposed schedule
  const [requestedStartAt, setRequestedStartAt] = useState<string>("");
  const [requestedEndAt, setRequestedEndAt] = useState<string>("");
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [requestedStartHour, setRequestedStartHour] = useState<number | null>(null);
  const [requestedEndHourExclusive, setRequestedEndHourExclusive] = useState<number | null>(null);

  // Payment preference
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRIS");

  const selectedSimulator = useMemo(
    () => simulators.find((s) => s.id === simulatorId) ?? null,
    [simulators, simulatorId],
  );

  const differencesAllowed = useMemo(() => selectedSimulator?.category === "BOEING", [selectedSimulator]);

  useEffect(() => {
    (async () => {
      const [simRes, profRes] = await Promise.all([fetch("/api/simulators"), fetch("/api/profile")]);

      const simJson = (await simRes.json().catch(() => null)) as ApiRes<{ simulators: Simulator[] }> | null;
      if (simRes.ok && simJson?.ok) {
        setSimulators(simJson.data.simulators);
        if (!simulatorId && simJson.data.simulators.length > 0) setSimulatorId(simJson.data.simulators[0].id);
      }

      const profJson = (await profRes.json().catch(() => null)) as ApiRes<{ profile: Profile | null; user?: { email: string | null } | null }> | null;
      if (profRes.ok && profJson?.ok) {
        setProfile(profJson.data.profile);
        const p = profJson.data.profile;
        if (p) {
          setRegistrationTypeChoice(p.registrationType);
          setFullName(p.fullName ?? "");
          setCompanyName(p.companyName ?? "");
          setNpwp(p.npwp ?? "");
          setLicenseNo(p.licenseNo ?? "");
          setPhone(p.phone ?? "");
          setAddress(p.address ?? "");
          setFlightHours(p.flightHours !== null && p.flightHours !== undefined ? String(p.flightHours) : "");
        }

        const existingEmail = (profJson.data.user?.email ?? p?.email) ?? "";
        if (existingEmail) setEmail(existingEmail);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leaseType !== "WET") return;
    if (!differencesAllowed && wetTraining === "DIFFERENCES") setWetTraining("PPC");
  }, [differencesAllowed, leaseType, wetTraining]);

  useEffect(() => {
    if (leaseType === "DRY") {
      setDeviceType("");
      setRequestedStartAt("");
      setRequestedEndAt("");
      setRequestedDate("");
      setRequestedStartHour(null);
      setRequestedEndHourExclusive(null);
    }
  }, [leaseType]);

  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  function addDays(dateStr: string, days: number) {
    const [yyyy, mm, dd] = dateStr.split("-").map((v) => Number.parseInt(v, 10));
    const d = new Date(yyyy, (mm ?? 1) - 1, (dd ?? 1) + days);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function clearScheduleSelection() {
    setRequestedStartHour(null);
    setRequestedEndHourExclusive(null);
    setRequestedStartAt("");
    setRequestedEndAt("");
  }

  function setScheduleRange(dateStr: string, startHour: number, endHourExclusive: number) {
    const safeStart = Math.min(Math.max(startHour, 0), 23);
    const safeEnd = Math.min(Math.max(endHourExclusive, safeStart + 1), 24);

    const startLocal = `${dateStr}T${pad2(safeStart)}:00`;
    const endDateStr = safeEnd === 24 ? addDays(dateStr, 1) : dateStr;
    const endLocal = `${endDateStr}T${safeEnd === 24 ? "00" : pad2(safeEnd)}:00`;

    setRequestedDate(dateStr);
    setRequestedStartHour(safeStart);
    setRequestedEndHourExclusive(safeEnd);
    setRequestedStartAt(startLocal);
    setRequestedEndAt(endLocal);
  }

  function setScheduleFromDateAndHour(dateStr: string, startHour: number) {
    setScheduleRange(dateStr, startHour, startHour + 1);
  }

  const wetTrainingName = useMemo(() => {
    if (wetTraining === "PPC") return "Pilot Proficiency Training (PPC)";
    if (wetTraining === "TYPE_RATING") return "Initial Type Rating";
    return "Differences";
  }, [wetTraining]);

  const trainingCodeForApi = useMemo<"PPC" | "TYPE_RATING" | "OTHER">(() => {
    if (wetTraining === "PPC") return "PPC";
    if (wetTraining === "TYPE_RATING") return "TYPE_RATING";
    return "OTHER";
  }, [wetTraining]);

  const canNextFromStep0 = useMemo(() => {
    if (!simulatorId) return false;
    if (leaseType === "WET") return personCount === 1 || personCount === 2;
    if (leaseType === "DRY") return Boolean(deviceType);
    return false;
  }, [deviceType, leaseType, personCount, simulatorId]);

  function goPrev() {
    setError(null);
    setStep((s) => (s === 0 ? 0 : ((s - 1) as WizardStep)));
  }

  async function goNext() {
    setError(null);

    if (step === 0) {
      if (!canNextFromStep0) {
        setError("Lengkapi pilihan Training Type terlebih dahulu.");
        return;
      }

      setStep(1);
      return;
    }

    if (step === 1) {
      // For WET, we save personal info + uploads before moving to payment preference.
      if (!fullName.trim()) {
        setError("Full Name wajib diisi");
        return;
      }
      if (!phone.trim()) {
        setError("Phone Number wajib diisi");
        return;
      }

      if (leaseType === "DRY") {
        if (!email.trim()) {
          setError("Email Address wajib diisi untuk Dry Leased");
          return;
        }
        if (registrationTypeChoice === "COMPANY" && !companyName.trim()) {
          setError("Company wajib diisi jika memilih Registration Type: Company");
          return;
        }
      }

      if (leaseType === "WET") {
        if (!licenseNo.trim()) {
          setError("Licence No wajib diisi");
          return;
        }
        if (!idScanFile || !licenseFile || !medicalFile) {
          setError("Dokumen wajib: ID, Licence, Medical (PDF)");
          return;
        }
      }

      const requiredIdScanFile = idScanFile;
      const requiredLicenseFile = licenseFile;
      const requiredMedicalFile = medicalFile;

      if (!requestedStartAt || !requestedEndAt) {
        setError("Isi jadwal booking (mulai & selesai)");
        return;
      }
      const start = new Date(requestedStartAt);
      const end = new Date(requestedEndAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        setError("Format tanggal/jam tidak valid");
        return;
      }
      if (end.getTime() <= start.getTime()) {
        setError("Jam selesai harus setelah jam mulai");
        return;
      }

      setLoading(true);
      try {
        const hoursInt = flightHours.trim() ? Number.parseInt(flightHours.trim(), 10) : undefined;

        const normalizedEmail = email.trim();
        const shouldUpdateEmail = leaseType === "DRY" || Boolean(normalizedEmail);
        const shouldUpdateCompany = registrationTypeChoice === "COMPANY";

        const profRes = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            companyName: shouldUpdateCompany ? (companyName ? companyName : null) : undefined,
            npwp: leaseType === "WET" ? (npwp ? npwp : null) : undefined,
            email: shouldUpdateEmail ? (normalizedEmail ? normalizedEmail : null) : undefined,
            licenseNo: leaseType === "WET" ? licenseNo : undefined,
            flightHours: leaseType === "WET" && Number.isFinite(hoursInt) ? hoursInt : undefined,
            phone,
            address: leaseType === "WET" ? address : undefined,
          }),
        });

        const profJson = await profRes.json().catch(() => null);
        if (!profRes.ok) {
          setError(profJson?.error?.message ?? "Gagal menyimpan personal info");
          setLoading(false);
          return;
        }

        if (leaseType === "WET") {
          async function upload(type: string, file: File) {
            const form = new FormData();
            form.append("type", type);
            form.append("file", file);
            const res = await fetch("/api/documents/upload", { method: "POST", body: form });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error?.message ?? `Gagal upload ${type}`);
          }

          if (!requiredIdScanFile || !requiredLicenseFile || !requiredMedicalFile) {
            throw new Error("Dokumen wajib: ID, Licence, Medical (PDF)");
          }

          await upload("ID", requiredIdScanFile);
          await upload("LICENSE", requiredLicenseFile);
          await upload("MEDICAL", requiredMedicalFile);
          if (logbookFile) await upload("LOGBOOK", logbookFile);
          if (photoFile) await upload("PHOTO", photoFile);
          if (cvFile) await upload("CV", cvFile);
        }

        setStep(2);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses data");
      } finally {
        setLoading(false);
      }

      return;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!simulatorId) {
      setError("Pilih simulator");
      return;
    }

    if (!requestedStartAt || !requestedEndAt) {
      setError("Isi jadwal booking (mulai & selesai)");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulatorId,
        leaseType,
        trainingCode: leaseType === "WET" ? trainingCodeForApi : "OTHER",
        trainingName: leaseType === "WET" ? wetTrainingName : "Dry Leased",
        personCount: leaseType === "WET" ? personCount : undefined,
        deviceType: leaseType === "DRY" && deviceType ? deviceType : undefined,
        paymentMethod,
        requestedStartAt: new Date(requestedStartAt).toISOString(),
        requestedEndAt: new Date(requestedEndAt).toISOString(),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Gagal membuat booking");
      setLoading(false);
      return;
    }

    const bookingId = json.data.booking.id as string;

    // Auto-submit for admin verification (align with requested flow).
    await fetch(`/api/bookings/${bookingId}/submit`, { method: "POST" }).catch(() => null);

    router.push(`/user/bookings/${bookingId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Booking</h1>
        <p className="mt-1 text-sm text-zinc-600">Ikuti langkah berikut untuk melakukan booking.</p>
      </div>

      {/* Stepper */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:flex sm:items-start sm:justify-between sm:gap-3">
            {[{
              title: "Training Type",
              subtitle: "Select Your Training",
            }, {
              title: "Personal Info",
              subtitle: "Enter Your Personal Info",
            }, {
              title: "Payment",
              subtitle: "Select Payment Method",
            }].map((s, idx) => {
              const isActive = step === idx;
              const isDone = step > idx;
              return (
                <div key={s.title} className="flex items-center gap-3 sm:flex-1">
                  <div
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold " +
                      (isActive || isDone
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700")
                    }
                    aria-hidden
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={(isActive ? "text-zinc-900" : "text-zinc-600") + " text-sm font-medium"}>
                      {s.title}
                    </div>
                    <div className="text-xs text-zinc-500">{s.subtitle}</div>
                  </div>

                  {idx < 2 ? <div className="hidden flex-1 border-t border-zinc-200 sm:block" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        {/* Step 1: Training Type */}
        {step === 0 ? (
          <div className="grid gap-4">
            <div>
              <div className="text-lg font-semibold tracking-tight">Training Type</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Select Simulator</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={simulatorId}
                  onChange={(e) => setSimulatorId(e.target.value)}
                >
                  {simulators.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.category} {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Select Leased Type</span>
                <select
                  className="h-10 rounded-lg border border-zinc-200 px-3"
                  value={leaseType}
                  onChange={(e) => setLeaseType(e.target.value as LeaseType)}
                >
                  <option value="WET">Wet Leased</option>
                  <option value="DRY">Dry Leased</option>
                </select>
              </label>
            </div>

            {leaseType === "WET" ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Select Training</span>
                  <select
                    className="h-10 rounded-lg border border-zinc-200 px-3"
                    value={wetTraining}
                    onChange={(e) => setWetTraining(e.target.value as WetTraining)}
                  >
                    <option value="PPC">Pilot Proficiency Training (PPC)</option>
                    <option value="TYPE_RATING">Initial Type Rating</option>
                    {differencesAllowed ? <option value="DIFFERENCES">Differences</option> : null}
                  </select>
                  {!differencesAllowed ? <span className="text-xs text-zinc-500">Differences hanya tersedia untuk Boeing.</span> : null}
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Select Person</span>
                  <select
                    className="h-10 rounded-lg border border-zinc-200 px-3"
                    value={personCount}
                    onChange={(e) => setPersonCount((Number(e.target.value) as 1 | 2) ?? 1)}
                  >
                    <option value={1}>1 Person</option>
                    <option value={2}>2 Person</option>
                  </select>
                </label>
              </>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm md:max-w-md">
                  <span className="font-medium">Select Device</span>
                  <select
                    className="h-10 rounded-lg border border-zinc-200 px-3"
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  >
                    <option value="" disabled>Pilih device...</option>
                    <option value="FFS">Full Flight Simulator (FFS)</option>
                    <option value="FTD">Flight Training Device (FTD)</option>
                  </select>
                </label>

                {deviceType ? (
                  <div className="grid gap-1 text-sm">
                    <span className="font-medium">Registration Type</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRegistrationTypeChoice("PERSONAL")}
                        className={
                          "h-10 rounded-lg border px-3 text-sm " +
                          (registrationTypeChoice === "PERSONAL"
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50")
                        }
                      >
                        Personal
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegistrationTypeChoice("COMPANY")}
                        className={
                          "h-10 rounded-lg border px-3 text-sm " +
                          (registrationTypeChoice === "COMPANY"
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50")
                        }
                      >
                        Company
                      </button>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Profil saat ini: <span className="font-medium">{profile?.registrationType ?? "-"}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              <div className="font-medium">Ringkasan</div>
              <div className="mt-1">Simulator: {selectedSimulator ? `${selectedSimulator.category} ${selectedSimulator.name}` : "-"}</div>
              <div>Leased: {leaseType === "WET" ? "Wet Leased" : "Dry Leased"}</div>
              {leaseType === "WET" ? (
                <>
                  <div>Training: {wetTrainingName}</div>
                  <div>Person: {personCount} Person</div>
                </>
              ) : (
                <>
                  <div>Device: {deviceType || "-"}</div>
                  <div>Registration Type: {registrationTypeChoice}</div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Step 2: Personal Info */}
        {step === 1 ? (
          <div className="grid gap-4">
            <div className="text-lg font-semibold tracking-tight">Personal Info</div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="grid gap-1">
                <div className="text-sm font-semibold">{leaseType === "WET" ? "Person 1" : "Company Contact"}</div>
                <div className="text-sm text-zinc-600">{leaseType === "WET" ? "Enter your identity" : "Masukkan data kontak untuk Dry Leased"}</div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Full Name</span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3"
                      placeholder="Enter Your Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Phone Number</span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3"
                      placeholder="Enter Your Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                </div>

                <div className={"grid gap-3 " + (registrationTypeChoice === "COMPANY" ? "md:grid-cols-2" : "md:grid-cols-1")}>
                  {registrationTypeChoice === "COMPANY" ? (
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">Company</span>
                      <input
                        className="h-10 rounded-lg border border-zinc-200 px-3"
                        placeholder="Enter Your Company"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                      <span className="text-xs text-zinc-500">Wajib jika memilih Registration Type: Company.</span>
                    </label>
                  ) : null}

                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Email Address</span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3"
                      placeholder="Enter Your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {leaseType === "DRY" ? <span className="text-xs text-zinc-500">Wajib untuk Dry Leased.</span> : null}
                  </label>
                </div>

                {leaseType === "WET" ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium">NPWP</span>
                        <input
                          className="h-10 rounded-lg border border-zinc-200 px-3"
                          placeholder="Enter Your npwp"
                          value={npwp}
                          onChange={(e) => setNpwp(e.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium">Licence No</span>
                        <input
                          className="h-10 rounded-lg border border-zinc-200 px-3"
                          placeholder="Enter Your Licence No"
                          value={licenseNo}
                          onChange={(e) => setLicenseNo(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium">Address</span>
                        <input
                          className="h-10 rounded-lg border border-zinc-200 px-3"
                          placeholder="Enter Your Address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium">Total Flying Hours</span>
                        <input
                          className="h-10 rounded-lg border border-zinc-200 px-3"
                          placeholder="e.g. 120"
                          value={flightHours}
                          onChange={(e) => setFlightHours(e.target.value)}
                        />
                        <span className="text-xs text-zinc-500">Angka total jam terbang (opsional).</span>
                      </label>
                    </div>

                    <div className="mt-2 border-t border-zinc-200 pt-4">
                      <div className="text-sm font-semibold">Upload Dokumen</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Scan KTP/SIM/Passport (PDF)</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setIdScanFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Wajib.</span>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Scan Licence (PDF, semua halaman)</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Wajib.</span>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Scan Medical Certificate (PDF)</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setMedicalFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Wajib.</span>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Logbook 3 bulan terakhir (PDF)</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setLogbookFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Opsional.</span>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Foto (background merah, JPG/PNG)</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Opsional.</span>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Curriculum Vitae (PDF)</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="text-xs text-zinc-500">Opsional.</span>
                        </label>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="grid gap-2">
                <div className="text-sm font-semibold">Isi tanggal dan jam booking</div>
                <label className="grid gap-1 text-sm md:max-w-xs">
                  <span className="font-medium">Select Date</span>
                  <input
                    type="date"
                    className="h-10 rounded-lg border border-zinc-200 bg-white px-3"
                    value={requestedDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setRequestedDate(nextDate);
                      clearScheduleSelection();
                    }}
                  />
                </label>

                {requestedDate ? (
                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Select Time</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {Array.from({ length: 24 }, (_, h) => {
                        const label = `${pad2(h)}:00-${pad2((h + 1) % 24)}:00`;
                        const isSelected =
                          requestedStartHour !== null &&
                          requestedEndHourExclusive !== null &&
                          h >= requestedStartHour &&
                          h < requestedEndHourExclusive;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              if (!requestedDate) return;
                              if (requestedStartHour === null || requestedEndHourExclusive === null) {
                                setScheduleRange(requestedDate, h, h + 1);
                                return;
                              }

                              // Toggle off if single-slot selected and clicked again
                              if (h === requestedStartHour && requestedEndHourExclusive === requestedStartHour + 1) {
                                clearScheduleSelection();
                                return;
                              }

                              if (h < requestedStartHour) {
                                setScheduleRange(requestedDate, h, requestedEndHourExclusive);
                                return;
                              }

                              setScheduleRange(requestedDate, requestedStartHour, h + 1);
                            }}
                            className={
                              "h-11 w-full rounded-lg border text-sm font-medium transition " +
                              (isSelected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-emerald-500/70 bg-white text-emerald-700 hover:bg-emerald-50")
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Tip: klik jam awal, lalu klik jam terakhir untuk memperpanjang. Klik lagi slot yang sama (jika 1 jam) untuk batal.
                    </div>
                  </div>
                ) : null}

                {requestedStartAt && requestedEndAt ? (
                  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                    Dipilih:{" "}
                    <span className="font-medium">
                      {requestedStartAt.replace("T", " ")} - {requestedEndAt.replace("T", " ")}
                      {requestedStartHour !== null && requestedEndHourExclusive !== null
                        ? ` (${requestedEndHourExclusive - requestedStartHour} jam)`
                        : ""}
                    </span>
                  </div>
                ) : null}
                <div className="text-xs text-zinc-500">
                  Catatan: jadwal ini adalah preferensi. Penguncian jadwal final mengikuti proses verifikasi & pembayaran.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Step 3: Payment */}
        {step === 2 ? (
          <div className="grid gap-4">
            <div className="text-lg font-semibold tracking-tight">Payment</div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Select Payment Method</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 px-3"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="QRIS">QRIS</option>
                <option value="TRANSFER">Transfer</option>
              </select>
              <span className="text-xs text-zinc-500">
                Metode pembayaran disimpan sebagai preferensi. Instruksi pembayaran akan tersedia setelah proses verifikasi.
              </span>
            </label>
          </div>
        ) : null}

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50" href="/user/dashboard">Batal</a>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Previous
              </button>
            ) : null}

            {step < 2 ? (
              <button
                type="button"
                onClick={() => void goNext()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                {loading ? "Memproses..." : "Next"}
              </button>
            ) : (
              <button
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
