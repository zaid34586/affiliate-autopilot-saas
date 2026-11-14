// Module C Slice 2 verify: audience comment replies (approval levels + guardrails)
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
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `comments-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Comments Verify"}, ${hash}, 'credentials')
    returning id`;
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'Comments WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'comment_rani', 'Test character')`;

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

  // 1. settings: default semi
  res = await fetch(`${BASE}/api/dashboard/character/settings`, { headers: { cookie: cookieHeader() } });
  let body = await res.json();
  check("settings GET default semi", res.status === 200 && body.settings?.comments === "semi", `mode=${body.settings?.comments}`);

  // 2. switch to auto
  res = await fetch(`${BASE}/api/dashboard/character/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ comments: "auto" }),
  });
  body = await res.json();
  check("settings PUT auto", res.status === 200 && body.settings?.comments === "auto", `mode=${body.settings?.comments}`);

  // 3. auto mode: positive comment → auto-sent (sandbox)
  let r = await post("/api/dashboard/comments", {
    platform: "instagram", authorHandle: "fan_no1", body: "love this, amazing video!",
  });
  check("auto positive → replied", r.status === 201 && r.body.status === "replied", `status=${r.body.status}`);
  check("autoSent true", r.body.autoSent === true);
  check("delivery sandbox (honest)", r.body.delivery === "sandbox", `delivery=${r.body.delivery}`);

  // 4. auto mode: negative → held for review (pending)
  r = await post("/api/dashboard/comments", {
    platform: "instagram", authorHandle: "critic9", body: "worst product ever",
  });
  check("auto negative → pending (held)", r.status === 201 && r.body.status === "pending", `status=${r.body.status}`);
  const negId = r.body.id;

  // 5. back to semi
  res = await fetch(`${BASE}/api/dashboard/character/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ comments: "semi" }),
  });
  await res.json();

  // 6. semi mode: buy intent → pending + price-free suggestion
  r = await post("/api/dashboard/comments", {
    platform: "youtube", authorHandle: "buyer_bob", body: "kitne ka hai ye? price batao",
  });
  check("semi buy-intent → pending", r.status === 201 && r.body.status === "pending", `status=${r.body.status}`);
  check("suggestion has no price", !/\$\d/.test(r.body.suggestedReply ?? ""), `reply="${(r.body.suggestedReply ?? "").slice(0, 50)}..."`);
  const buyId = r.body.id;

  // 7. semi mode: abusive → dismissed + blocked
  r = await post("/api/dashboard/comments", {
    platform: "instagram", authorHandle: "troll_x", body: "you are an idiot, shut up",
  });
  check("abusive → dismissed", r.status === 201 && r.body.status === "dismissed", `status=${r.body.status}`);
  check("abusive → no reply generated", (r.body.suggestedReply ?? "") === "");

  // 8. approve buy-intent reply
  r = await post(`/api/dashboard/comments/${buyId}/reply`, {});
  check("approve → success + sandbox", r.status === 200 && r.body.delivery === "sandbox", `delivery=${r.body.delivery}`);

  // 9. double approve → 400
  r = await post(`/api/dashboard/comments/${buyId}/reply`, {});
  check("double approve rejected", r.status === 400, `status=${r.status}`);

  // 10. dismiss negative held comment
  r = await post(`/api/dashboard/comments/${negId}/dismiss`, {});
  check("dismiss works", r.status === 200, `status=${r.status}`);

  // 11. list shows all four
  res = await fetch(`${BASE}/api/dashboard/comments`, { headers: { cookie: cookieHeader() } });
  body = await res.json();
  check("list 200", res.status === 200, `status=${res.status}`);
  check("list has 4 comments", body.comments?.length === 4, `n=${body.comments?.length}`);
  const replied = body.comments.filter((c) => c.status === "replied").length;
  check("replied count = 2", replied === 2, `n=${replied}`);

  // 12. mode off → stored without reply
  res = await fetch(`${BASE}/api/dashboard/character/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ comments: "off" }),
  });
  await res.json();
  r = await post("/api/dashboard/comments", {
    platform: "x", authorHandle: "late_arrival", body: "nice one",
  });
  check("mode off → dismissed w/o reply", r.status === 201 && r.body.status === "dismissed" && r.body.suggestedReply === "", `status=${r.body.status}`);

  // 13. validation: bad platform → 400
  r = await post("/api/dashboard/comments", {
    platform: "myspace", authorHandle: "x", body: "hi",
  });
  check("bad platform rejected", r.status === 400, `status=${r.status}`);

  // 14. unauthenticated → 401
  res = await fetch(`${BASE}/api/dashboard/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "x", authorHandle: "a", body: "b" }) });
  check("unauthenticated rejected", res.status === 401, `status=${res.status}`);

  // 15. character page shows the inbox
  res = await fetch(`${BASE}/dashboard/character`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("character page has comments inbox", html.includes("Audience comments"));

  await sql.end();
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("COMMENTS VERIFY ERROR:", e.message);
  process.exit(1);
});
