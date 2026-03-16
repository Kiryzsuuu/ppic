const baseUrl = process.env.BASE_URL || "http://localhost:3001";

function rand(n = 8) {
  return Math.random().toString(16).slice(2, 2 + n);
}

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const stamp = `${Date.now()}_${rand(6)}`;
  const username = `test_${stamp}`.slice(0, 32);
  const email = `test.${stamp}@example.com`;
  const password = `P@ssw0rd_${rand(10)}`;

  console.log(`[E2E] BASE_URL=${baseUrl}`);
  console.log(`[E2E] Register username=${username} email=${email}`);

  const register = await postJson("/api/auth/register", {
    username,
    password,
    registrationType: "PERSONAL",
    fullName: "E2E Test User",
    email,
  });

  if (!register.ok) {
    console.error("[E2E] Register failed", { status: register.status, error: register.json?.error });
    process.exit(1);
  }

  console.log("[E2E] Register ok", { status: register.status, user: register.json?.data?.user ?? register.json?.user ?? null });

  const loginEmail = await postJson("/api/auth/login", {
    identifier: email,
    password,
  });

  if (!loginEmail.ok) {
    console.error("[E2E] Login by email failed", { status: loginEmail.status, error: loginEmail.json?.error });
    process.exit(1);
  }

  console.log("[E2E] Login by email ok", { status: loginEmail.status, user: loginEmail.json?.data?.user ?? loginEmail.json?.user ?? null });

  const loginEmailUpper = await postJson("/api/auth/login", {
    identifier: email.toUpperCase(),
    password,
  });

  if (!loginEmailUpper.ok) {
    console.error("[E2E] Login by email (upper) failed", { status: loginEmailUpper.status, error: loginEmailUpper.json?.error });
    process.exit(1);
  }

  console.log("[E2E] Login by email (upper) ok", { status: loginEmailUpper.status, user: loginEmailUpper.json?.data?.user ?? loginEmailUpper.json?.user ?? null });

  const loginUsername = await postJson("/api/auth/login", {
    identifier: username,
    password,
  });

  if (!loginUsername.ok) {
    console.error("[E2E] Login by username failed", { status: loginUsername.status, error: loginUsername.json?.error });
    process.exit(1);
  }

  console.log("[E2E] Login by username ok", { status: loginUsername.status, user: loginUsername.json?.data?.user ?? loginUsername.json?.user ?? null });

  console.log("[E2E] SUCCESS");
}

main().catch((e) => {
  console.error("[E2E] Unhandled error", e);
  process.exit(1);
});
