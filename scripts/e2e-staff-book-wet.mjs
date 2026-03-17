const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const identifier = process.env.E2E_IDENTIFIER || "admin";
const password = process.env.E2E_PASSWORD || "";
const otpCode = process.env.E2E_OTP || "";

function jsonHeaders(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

function extractCookies(res) {
  // Node 20+ has getSetCookie(). Fallback to single set-cookie header.
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
    const [k, v] = c.split("=");
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

function wibIso(dateKey, hhmm) {
  return new Date(`${dateKey}T${hhmm}:00+07:00`).toISOString();
}

function fmtWib(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function main() {
  const dateKey = process.env.DATE_KEY || "2026-03-17";

  console.log(`[E2E] BASE_URL=${baseUrl}`);
  console.log(`[E2E] dateKey=${dateKey}`);

  if (!process.env.E2E_IDENTIFIER) {
    console.log(`[E2E] using default identifier=${identifier} (set E2E_IDENTIFIER to override)`);
  }

  if (!process.env.E2E_PASSWORD) {
    console.error("[E2E] Missing E2E_PASSWORD. Set E2E_PASSWORD then rerun.");
    process.exit(2);
  }

  // 1) Login as seeded admin
  let jar = [];
  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    body: { identifier, password },
  });

  if (!login.ok) {
    console.error("[E2E] admin login failed", login);
    process.exit(1);
  }

  jar = mergeCookieJar(jar, login.setCookies);
  const role = login.json?.data?.user?.role ?? login.json?.user?.role ?? null;
  const emailVerified = login.json?.data?.user?.emailVerified ?? login.json?.user?.emailVerified ?? null;
  console.log(`[E2E] login ok status=${login.status} role=${role} emailVerified=${emailVerified} cookies=${jar.length}`);

  if (role !== "ADMIN") {
    console.error(`[E2E] This E2E flow needs an ADMIN session (current role=${role}).`);
    process.exit(1);
  }

  // Middleware redirects /api/* to /verify-email if emailVerified=false.
  // If so, request OTP and optionally verify it if E2E_OTP is provided.
  const probe = await fetchJson("/api/simulators", { cookieJar: jar });
  const probeRaw = probe.json?._raw;
  const isHtml = typeof probeRaw === "string" && probeRaw.trim().startsWith("<!DOCTYPE html");

  if (!probe.ok || isHtml) {
    console.log("[E2E] API access appears gated by email verification. Requesting OTP...");

    const reqOtp = await fetchJson("/api/auth/otp/request", { method: "POST", cookieJar: jar });
    if (!reqOtp.ok) {
      console.error("[E2E] otp request failed", reqOtp);
      process.exit(1);
    }
    console.log(`[E2E] otp requested delivery=${reqOtp.json?.data?.delivery ?? "?"} expiresAt=${reqOtp.json?.data?.expiresAt ?? "?"}`);

    if (!otpCode) {
      console.log("[E2E] Set E2E_OTP=<6digit> then rerun to continue.");
      console.log("[E2E] In development, the server logs print: [otp:dev] OTP code { code: '......' }");
      process.exit(2);
    }

    const verifyOtp = await fetchJson("/api/auth/otp/verify", {
      method: "POST",
      cookieJar: jar,
      body: { code: otpCode },
    });

    if (!verifyOtp.ok) {
      console.error("[E2E] otp verify failed", verifyOtp);
      process.exit(1);
    }

    jar = mergeCookieJar(jar, verifyOtp.setCookies);
    console.log("[E2E] otp verified; refreshed session cookie.");
  }

  // 2) Get simulators (need auth)
  const sims = await fetchJson("/api/simulators", { cookieJar: jar });
  if (!sims.ok) {
    console.error("[E2E] /api/simulators failed", sims);
    process.exit(1);
  }

  const simulators = sims.json?.data?.simulators ?? sims.json?.simulators ?? [];
  if (!Array.isArray(simulators) || simulators.length === 0) {
    console.error("[E2E] /api/simulators returned empty list");
    console.error("[E2E] cookieJar", jar);
    console.error("[E2E] response", sims.status, sims.json);
  }
  const a320 = simulators.find((s) => String(s.name).toUpperCase() === "A320" && String(s.category).toUpperCase() === "AIRBUS");
  if (!a320) {
    console.error("[E2E] A320 simulator not found", simulators);
    process.exit(1);
  }
  console.log(`[E2E] simulator A320 id=${a320.id}`);

  // 3) Pick a user to book for
  const usersRes = await fetchJson("/api/admin/users?take=50", { cookieJar: jar });
  if (!usersRes.ok) {
    console.error("[E2E] /api/admin/users failed", usersRes);
    process.exit(1);
  }

  const users = usersRes.json?.data?.users ?? usersRes.json?.users ?? [];
  const bookUser = users.find((u) => u?.profile) || users[0];
  if (!bookUser) {
    console.error("[E2E] no users found to book for");
    process.exit(1);
  }
  console.log(`[E2E] booking for userId=${bookUser.id}`);

  // 4) Create full-day slot (auto creates two session slots)
  const createSlot = await fetchJson("/api/admin/slots", {
    method: "POST",
    cookieJar: jar,
    body: {
      simulatorId: a320.id,
      startAt: wibIso(dateKey, "07:30"),
      endAt: wibIso(dateKey, "15:45"),
    },
  });

  if (!createSlot.ok) {
    if (createSlot.status === 409) {
      console.log(
        `[E2E] create full-day slot skipped (409 conflict). Continuing to staff-book using existing availability...`,
      );
    } else {
      console.error("[E2E] create full-day slot failed", createSlot);
      process.exit(1);
    }
  } else {
    console.log(`[E2E] create slot ok status=${createSlot.status}`);
  }

  // 5) Attempt staff booking WET afternoon
  const staffBook = await fetchJson("/api/admin/bookings/staff-book", {
    method: "POST",
    cookieJar: jar,
    body: {
      leaseType: "WET",
      userId: bookUser.id,
      simulatorId: a320.id,
      dateKey,
      sessionKey: "AFTERNOON",
      trainingCode: "PPC",
      trainingName: "Pilot Proficiency Training (PPC)",
      personCount: 1,
    },
  });

  if (!staffBook.ok) {
    console.error("[E2E] staff-book WET afternoon FAILED", staffBook);

    const fromIso = wibIso(dateKey, "00:00");
    const toIso = wibIso(dateKey, "23:59");

    const publicFeed = await fetchJson(
      `/api/public/slots?simulatorId=${encodeURIComponent(a320.id)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    );
    console.error("[E2E] public slots feed status", publicFeed.status);

    const wet = Array.isArray(publicFeed.json?.data?.slots)
      ? publicFeed.json.data.slots.filter((s) => s.leaseType === "WET")
      : Array.isArray(publicFeed.json?.slots)
        ? publicFeed.json.slots.filter((s) => s.leaseType === "WET")
        : [];
    console.error(
      "[E2E] public slots (WET) for date",
      wet.map((s) => ({ id: s.id, status: s.status, startAtWib: fmtWib(s.startAt), endAtWib: fmtWib(s.endAt) })),
    );

    if (wet.length === 0) {
      const raw = publicFeed.json?._raw;
      if (typeof raw === "string") {
        console.error("[E2E] public slots feed looks non-JSON; first 120 chars:", raw.slice(0, 120));
      } else {
        console.error(
          "[E2E] public slots feed raw json (truncated)",
          JSON.stringify(publicFeed.json, null, 2).slice(0, 1200),
        );
      }
    }

    const inspectAdminSlots = await fetchJson(
      `/api/admin/slots?simulatorId=${encodeURIComponent(a320.id)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      { cookieJar: jar },
    );
    const adminSlots = inspectAdminSlots.json?.data?.slots ?? inspectAdminSlots.json?.slots ?? [];
    console.error(
      "[E2E] admin slots (filtered) for date",
      Array.isArray(adminSlots)
        ? adminSlots.map((s) => ({
            id: s.id,
            status: s.status,
            bookingId: s.bookingId,
            startAtIso: s.startAt,
            endAtIso: s.endAt,
            startAtWib: fmtWib(s.startAt),
            endAtWib: fmtWib(s.endAt),
          }))
        : adminSlots,
    );

    process.exit(1);
  }

  console.log(`[E2E] staff-book ok status=${staffBook.status}`);
  console.log("[E2E] SUCCESS");
}

main().catch((e) => {
  console.error("[E2E] Unhandled error", e);
  process.exit(1);
});
