// Module C Slice 5 verify: Thinking Engine (daily journal + self-reflection)
const fs = require("fs");
const path = require("path");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const bcryptMod = require("bcryptjs");
const bcrypt = bcryptMod.default || bcryptMod;

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const rootEnv = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const DB_URL = rootEnv.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");

const jar = new Map();
function absorb(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
}
function cookieHeader() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

async function post(url, payload) {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `thinking-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Thinking Verify"}, ${hash}, 'credentials')
    returning id`;
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'Thinking WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'think_ajju', 'Test character')`;

  // Some analytics for the last 7 days + yesterday
  const today = new Date();
  const dayStr = (d) => d.toISOString().split("T")[0];
  const yesterday = dayStr(new Date(today.getTime() - 24 * 60 * 60 * 1000));
  for (let i = 6; i >= 0; i--) {
    const d = dayStr(new Date(today.getTime() - i * 24 * 60 * 60 * 1000));
    await sql`
      insert into analytics_daily (workspace_id, day, impressions, clicks, conversions, revenue)
      values (${ws.id}, ${d}, ${i === 0 ? 8400 : 6000 + i * 800}, ${i === 0 ? 180 : 150 + i * 20}, ${i === 0 ? 2 : 1}, ${i === 0 ? 24.5 : 15 + i * 2})
      on conflict do nothing`;
  }
  // 7 posts in the last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    await sql`
      insert into posts (workspace_id, platform, status, published_at)
      values (${ws.id}, 'instagram', 'published', ${d})`;
  }

  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email, password: "Test1234!", csrfToken, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  absorb(res);
  check("login", res.status < 400, `status=${res.status}`);

  // 1. GET journal (empty initially)
  res = await fetch(`${BASE}/api/dashboard/character/journal`, { headers: { cookie: cookieHeader() } });
  let body = await res.json();
  check("GET journal 200", res.status === 200, `status=${res.status}`);
  check("empty initially", body.entries?.length === 0, `n=${body.entries?.length}`);

  // 2. POST journal (run reflection for today)
  let r = await post(`/api/dashboard/character/journal`);
  check("POST journal 201", r.status === 201, `status=${r.status}`);
  check("created true", r.body.entry?.created === true, `created=${r.body.entry?.created}`);
  check("engine honest", r.body.entry?.engine === "rules-v1", `engine=${r.body.entry?.engine}`);
  check("date is today", r.body.entry?.date === dayStr(today), `date=${r.body.entry?.date}`);
  check("thought text present", typeof r.body.entry?.thoughtText === "string" && r.body.entry.thoughtText.length > 30);
  check("decision present", typeof r.body.entry?.decision === "string" && r.body.entry.decision.length > 10);
  check("confidence 0-100", r.body.entry?.confidence != null && r.body.entry.confidence >= 0 && r.body.entry.confidence <= 100, `conf=${r.body.entry?.confidence}`);
  check("reasoning bullets", Array.isArray(r.body.entry?.reasoning) && r.body.entry.reasoning.length >= 2, `n=${r.body.entry?.reasoning?.length}`);
  check("no money promises in thought", !/(will earn|guaranteed|risk-free|projected)/i.test(r.body.entry?.thoughtText ?? ""));
  check("no money promises in reasoning", !(r.body.entry?.reasoning ?? []).join(" ").match(/(will earn|guaranteed|risk-free|projected)/i));

  // 3. Idempotent: POST again updates same row
  r = await post(`/api/dashboard/character/journal`);
  check("POST idempotent 200", r.status === 200, `status=${r.status}`);
  check("created false", r.body.entry?.created === false, `created=${r.body.entry?.created}`);

  // 4. GET shows the entry
  res = await fetch(`${BASE}/api/dashboard/character/journal`, { headers: { cookie: cookieHeader() } });
  body = await res.json();
  check("GET shows 1 entry", body.entries?.length === 1, `n=${body.entries?.length}`);
  check("entry has why bullets", body.entries?.[0]?.reasoning?.length >= 2);

  // 5. Cron endpoint works (reflects all characters)
  res = await fetch(`${BASE}/api/cron/thinking`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cron-secret": process.env.THINKING_CRON_SECRET ?? "test-secret" },
  });
  body = await res.json();
  check("cron 200", res.status === 200, `status=${res.status}`);
  check("cron reflected >= 1", body.reflected >= 1, `reflected=${body.reflected}`);

  // 6. Character page renders with ThoughtJournal (SSR header)
  res = await fetch(`${BASE}/dashboard/character`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("character page loads", res.status === 200, `status=${res.status}`);
  check("thought journal header in HTML", html.includes("Thought journal"));

  // 7. Client source has rules-v1 engine label
  const clientSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "app", "(app)", "dashboard", "character", "thought-journal.tsx"),
    "utf8",
  );
  check("client has engine label", clientSrc.includes("engine: rules-v1"));
  check("client has honest note", clientSrc.includes("synced analytics, never a forecast"));

  await sql.end();
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("THINKING VERIFY ERROR:", e.message);
  process.exit(1);
});