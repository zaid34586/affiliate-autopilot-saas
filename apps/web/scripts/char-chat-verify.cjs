// Module C Slice 1 verify: character discussion chat API
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

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `char-chat-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Char Chat Verify"}, ${hash}, 'credentials')
    returning id`;

  // workspace (auto-created on first session use) + character
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'Char Chat WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'verify_rani', 'Test character')`;

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

  // 1. POST: what-to-post question
  res = await fetch(`${BASE}/api/dashboard/character/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ message: "kal kya post karein?" }),
  });
  let body = await res.json();
  check("chat POST 200", res.status === 200, `status=${res.status}`);
  check("intent classified", body.result?.intent === "what_to_post", `intent=${body.result?.intent}`);
  check("engine label honest", body.result?.engine === "rules-v1", `engine=${body.result?.engine}`);
  check("reply present", typeof body.result?.reply === "string" && body.result.reply.length > 20);
  check("reasoning present", Array.isArray(body.result?.reasoning) && body.result.reasoning.length >= 1, `n=${body.result?.reasoning?.length}`);
  check("3 suggestions", body.result?.suggestions?.length === 3, `n=${body.result?.suggestions?.length}`);
  check("history saved (2 msgs)", body.chat?.length === 2, `n=${body.chat?.length}`);

  // 2. GET: history persists
  res = await fetch(`${BASE}/api/dashboard/character/chat`, { headers: { cookie: cookieHeader() } });
  body = await res.json();
  check("GET history 200", res.status === 200, `status=${res.status}`);
  check("GET returns 2 messages", body.chat?.length === 2, `n=${body.chat?.length}`);

  // 3. earnings guardrail — zero data, no fabricated dollar figures
  res = await fetch(`${BASE}/api/dashboard/character/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ message: "what did we earn this week?" }),
  });
  body = await res.json();
  const reply = body.result?.reply ?? "";
  check("earnings intent", body.result?.intent === "earnings", `intent=${body.result?.intent}`);
  check("zero-data honesty (no invented $)", !/\$\d/.test(reply), `reply="${reply.slice(0, 60)}..."`);

  // 4. validation: empty message → 400
  res = await fetch(`${BASE}/api/dashboard/character/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ message: "" }),
  });
  check("empty message rejected", res.status === 400, `status=${res.status}`);

  // 5. validation: too long → 400
  res = await fetch(`${BASE}/api/dashboard/character/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ message: "x".repeat(501) }),
  });
  check("oversized message rejected", res.status === 400, `status=${res.status}`);

  // 6. unauthenticated → 401
  res = await fetch(`${BASE}/api/dashboard/character/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "hi" }) });
  check("unauthenticated rejected", res.status === 401, `status=${res.status}`);

  // 7. character page renders (with chat UI in DOM)
  res = await fetch(`${BASE}/dashboard/character`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("character page loads", res.status === 200, `status=${res.status}`);
  check("chat UI present", html.includes("Discuss with your character"));

  await sql.end();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("CHAR CHAT VERIFY ERROR:", e.message);
  process.exit(1);
});
