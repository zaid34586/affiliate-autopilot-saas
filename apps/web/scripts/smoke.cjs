// Smoke test: session login → dashboard render → proxy protection → workspace auto-create
const fs = require("fs");
const path = require("path");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const bcryptMod = require("bcryptjs");
const bcrypt = bcryptMod.default || bcryptMod;

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const rootEnv = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", ".env.local"),
  "utf8");
const DB_URL = rootEnv.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const jar = new Map();
function absorb(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `smoke-${Date.now()}@test.dev`;
  const password = "Test1234!";

  // 1. user banao (jaise signup action karta hai)
  const hash = await bcrypt.hash(password, 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Smoke Tester"}, ${hash}, 'credentials')
    returning id`;

  // 2. NextAuth credentials login
  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();

  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    }),
  });
  absorb(res);
  const hasSession = [...jar.keys()].some((k) => k.includes("session-token"));
  check("credentials login (session cookie bana)", res.status < 400 && hasSession, `status=${res.status}`);

  // 3. workspace auto-create (jwt callback)
  const ws = await sql`select id, name, plan from workspaces where owner_user_id = ${u.id}`;
  const members = await sql`select role from workspace_members where user_id = ${u.id}`;
  const ap = await sql`select level from autopilot_config where workspace_id = ${ws[0]?.id}`;
  check("workspace auto-created", ws.length === 1, ws[0]?.name);
  check("owner membership", members[0]?.role === "owner");
  check("autopilot config default", ap[0]?.level === "manual");

  // 4. dashboard session ke saath
  res = await fetch(`${BASE}/dashboard`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const body = await res.text();
  check("GET /dashboard 200 + checklist", res.status === 200 && body.includes("Getting started"));

  // 5. baaki protected pages
  for (const p of ["/onboarding", "/dashboard/character", "/dashboard/products", "/dashboard/dm-inbox", "/dashboard/settings"]) {
    const r = await fetch(`${BASE}${p}`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
    check(`GET ${p}`, r.status === 200, `status=${r.status}`);
  }

  // 6. login page pe logged-in → dashboard redirect (proxy)
  res = await fetch(`${BASE}/login`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  check("proxy: logged-in /login → /dashboard", res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/dashboard"), `loc=${res.headers.get("location")}`);

  // 7. bina session ke /dashboard → /login redirect
  res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("proxy: anon /dashboard → /login", res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/login"), `loc=${res.headers.get("location")}`);

  // 8. landing
  res = await fetch(`${BASE}/`, { redirect: "manual" });
  check("GET / 200", res.status === 200);

  // cleanup (FK-safe order)
  await sql`delete from workspaces where owner_user_id = ${u.id}`;
  await sql`delete from users where id = ${u.id}`;
  await sql.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("SMOKE ERROR:", e.message);
  process.exit(1);
});
