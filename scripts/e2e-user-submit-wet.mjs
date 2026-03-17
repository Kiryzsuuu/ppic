const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const identifier = process.env.E2E_IDENTIFIER || "user";
const password = process.env.E2E_PASSWORD || "";
const otpCode = process.env.E2E_OTP || "";
const autoUploadDocs = (process.env.AUTO_UPLOAD_DOCS || "1") === "1";

import { readFile } from "node:fs/promises";
import path from "node:path";

function jsonHeaders(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

function extractCookies(res) {
  const hdrs = res.headers;
  const raw = typeof hdrs.getSetCookie === "function" ? hdrs.getSetCookie() : [hdrs.get("set-cookie")].filter(Boolean);
  const cookies = [];
  for (const line of raw) {
    if (!line) continue;
    const first = String(line).split(";")[0];
    if (!first) continue;
    cookies.push(first);
  }
  return cookies;
}

function mergeCookieJar(jar, newCookies) {
  const map = new Map();
  for (const c of jar) {
    const [k] = c.split("=");
    if (k) map.set(k, c);
  }
  for (const c of newCookies) {
    const [k] = c.split("=");
    if (k) map.set(k, c);
  }
  return Array.from(map.values());
}

async function fetchJson(path, { method = "GET", body, cookieJar = [] } = {}) {
  const headers = jsonHeaders(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {});
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }

  const setCookies = extractCookies(res);
  return { ok: res.ok, status: res.status, json, setCookies };
}

async function uploadPdfDoc({ cookieJar, type, filePath }) {
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const fileName = `${type.toLowerCase()}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  const form = new FormData();
  form.set("type", type);
  form.set("file", file);

  const res = await fetch(`${baseUrl}/api/documents/upload`, {
    method: "POST",
    headers: cookieJar.length ? { Cookie: cookieJar.join("; ") } : undefined,
    body: form,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }

  return { ok: res.ok, status: res.status, json };
}

function wibIso(dateKey, hhmm) {
  return new Date(`${dateKey}T${hhmm}:00+07:00`).toISOString();
}

async function ensureOtpIfNeeded(jar) {
  // Probe authed endpoint; if HTML, user got redirected to /verify-email.
  const probe = await fetchJson("/api/me", { cookieJar: jar });
  const probeRaw = probe.json?._raw;
  const isHtml = typeof probeRaw === "string" && probeRaw.trim().startsWith("<!DOCTYPE html");

  if (probe.ok && !isHtml) return { jar, didOtp: false };

  console.log("[E2E-USER] API access gated by email verification. Requesting OTP...");
  const reqOtp = await fetchJson("/api/auth/otp/request", { method: "POST", cookieJar: jar });
  if (!reqOtp.ok) {
    console.error("[E2E-USER] otp request failed", reqOtp);
    process.exit(1);
  }

  if (!otpCode) {
    console.log("[E2E-USER] Set E2E_OTP=<6digit> then rerun to continue.");
    console.log("[E2E-USER] In development, the server logs print: [otp:dev] OTP code { code: '......' }");
    process.exit(2);
  }

  const verifyOtp = await fetchJson("/api/auth/otp/verify", {
    method: "POST",
    cookieJar: jar,
    body: { code: otpCode },
  });

  if (!verifyOtp.ok) {
    console.error("[E2E-USER] otp verify failed", verifyOtp);
    process.exit(1);
  }

  const nextJar = mergeCookieJar(jar, verifyOtp.setCookies);
  console.log("[E2E-USER] otp verified; refreshed session cookie.");
  return { jar: nextJar, didOtp: true };
}

async function main() {
  const dateKey = process.env.DATE_KEY || "2026-03-18";
  const sessionKey = process.env.SESSION_KEY || "AFTERNOON"; // MORNING | AFTERNOON

  console.log(`[E2E-USER] BASE_URL=${baseUrl}`);
  console.log(`[E2E-USER] dateKey=${dateKey} sessionKey=${sessionKey}`);

  if (!process.env.E2E_PASSWORD) {
    console.error("[E2E-USER] Missing E2E_PASSWORD. Set E2E_PASSWORD then rerun.");
    process.exit(2);
  }

  let jar = [];

  // 1) Login
  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    body: { identifier, password },
  });

  if (!login.ok) {
    console.error("[E2E-USER] login failed", login);
    process.exit(1);
  }

  jar = mergeCookieJar(jar, login.setCookies);
  const role = login.json?.data?.user?.role ?? login.json?.user?.role ?? null;
  const emailVerified = login.json?.data?.user?.emailVerified ?? login.json?.user?.emailVerified ?? null;
  console.log(`[E2E-USER] login ok status=${login.status} role=${role} emailVerified=${emailVerified} cookies=${jar.length}`);

  if (role !== "USER") {
    console.error(`[E2E-USER] This E2E flow expects role USER (current role=${role}).`);
    process.exit(1);
  }

  // 2) OTP if needed (middleware gate)
  const otp = await ensureOtpIfNeeded(jar);
  jar = otp.jar;

  // 3) Read user info
  const me = await fetchJson("/api/me", { cookieJar: jar });
  if (!me.ok) {
    console.error("[E2E-USER] /api/me failed", me);
    process.exit(1);
  }
  console.log(
    `[E2E-USER] me ok emailVerifiedAt=${me.json?.data?.user?.emailVerifiedAt ?? me.json?.user?.emailVerifiedAt ?? null}`,
  );

  // 4) Pick simulator (public endpoint)
  const sims = await fetchJson("/api/public/simulators");
  if (!sims.ok) {
    console.error("[E2E-USER] /api/public/simulators failed", sims);
    process.exit(1);
  }

  const simulators = sims.json?.data?.simulators ?? sims.json?.simulators ?? [];
  const a320 = simulators.find(
    (s) => String(s.name).toUpperCase() === "A320" && String(s.category).toUpperCase() === "AIRBUS",
  );
  if (!a320) {
    console.error("[E2E-USER] A320 simulator not found", simulators);
    process.exit(1);
  }
  console.log(`[E2E-USER] simulator A320 id=${a320.id}`);

  const requestedStartAt = sessionKey === "MORNING" ? wibIso(dateKey, "07:30") : wibIso(dateKey, "11:45");
  const requestedEndAt = sessionKey === "MORNING" ? wibIso(dateKey, "11:30") : wibIso(dateKey, "15:45");

  // 5) Create booking draft
  const createBooking = await fetchJson("/api/bookings", {
    method: "POST",
    cookieJar: jar,
    body: {
      simulatorId: a320.id,
      leaseType: "WET",
      trainingCode: "PPC",
      trainingName: "Pilot Proficiency Training (PPC)",
      personCount: 1,
      paymentMethod: "QRIS",
      requestedStartAt,
      requestedEndAt,
    },
  });

  if (!createBooking.ok) {
    console.error("[E2E-USER] create booking failed", createBooking);
    process.exit(1);
  }

  const bookingId = createBooking.json?.data?.booking?.id ?? createBooking.json?.booking?.id;
  const bookingStatus = createBooking.json?.data?.booking?.status ?? createBooking.json?.booking?.status;
  console.log(`[E2E-USER] booking created id=${bookingId} status=${bookingStatus}`);

  if (!bookingId) {
    console.error("[E2E-USER] booking id missing", createBooking.json);
    process.exit(1);
  }

  // 6) Submit booking (will enforce required docs)
  let submit = await fetchJson(`/api/bookings/${encodeURIComponent(bookingId)}/submit`, {
    method: "POST",
    cookieJar: jar,
  });

  if (!submit.ok) {
    const msg = submit.json?.error?.message ?? submit.json?.data?.error?.message ?? "";
    const isMissingDocs = typeof msg === "string" && msg.includes("Dokumen wajib belum lengkap");

    if (autoUploadDocs && isMissingDocs) {
      console.log("[E2E-USER] submit blocked by missing docs; uploading sample PDFs (LICENSE/MEDICAL/ID)...");

      const uploadBase = process.env.DOC_UPLOAD_BASE || path.join(process.cwd(), "uploads");
      const samples = [
        { type: "LICENSE", file: path.join(uploadBase, "1773211973730_1f5a6be16dda55c61205967d.pdf") },
        { type: "MEDICAL", file: path.join(uploadBase, "1773211984780_101bc9c5513f14231d485db4.pdf") },
        { type: "ID", file: path.join(uploadBase, "1773212006474_b40b5b07b38261f9b5a7a99c.pdf") },
      ];

      for (const s of samples) {
        const up = await uploadPdfDoc({ cookieJar: jar, type: s.type, filePath: s.file });
        if (!up.ok) {
          console.error(`[E2E-USER] upload ${s.type} failed`, up);
          process.exit(1);
        }
        console.log(`[E2E-USER] upload ${s.type} ok status=${up.status}`);
      }

      submit = await fetchJson(`/api/bookings/${encodeURIComponent(bookingId)}/submit`, {
        method: "POST",
        cookieJar: jar,
      });
    }
  }

  if (!submit.ok) {
    console.error("[E2E-USER] submit booking FAILED", submit);
    process.exit(1);
  }

  console.log(`[E2E-USER] submit ok status=${submit.status} newStatus=${submit.json?.data?.booking?.status ?? submit.json?.booking?.status}`);
  console.log("[E2E-USER] SUCCESS");
}

main().catch((e) => {
  console.error("[E2E-USER] Unhandled error", e);
  process.exit(1);
});
