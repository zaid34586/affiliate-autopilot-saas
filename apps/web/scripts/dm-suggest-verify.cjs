// Module C Slice 3 verify: DM suggested replies (character voice, guardrails)
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
  const email = `dm-suggest-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"DM Suggest Verify"}, ${hash}, 'credentials')
    returning id`;
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'DM Suggest WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'dm_rani', 'Test character')`;

  // DM with tracked link (draft, buy trigger)
  const [dmLink] = await sql`
    insert into dm_messages (workspace_id, platform, channel, recipient_handle, trigger_keyword, body, unique_link_code, status, approval_mode)
    values (${ws.id}, 'instagram', 'dm', 'fan_rohan', 'price', 'Thanks for your interest! Here is the link: {{link}}', 'abc123xyz', 'draft', 'semi')
    returning id`;
  // DM without tracked link (queued, how trigger)
  const [dmNoLink] = await sql`
    insert into dm_messages (workspace_id, platform, channel, recipient_handle, trigger_keyword, body, status, approval_mode)
    values (${ws.id}, 'youtube', 'dm', 'learner_meera', 'how', 'How do I start?', 'queued', 'semi')
    returning id`;
  // DM already sent (should be rejected)
  const [dmSent] = await sql`
    insert into dm_messages (workspace_id, platform, channel, recipient_handle, trigger_keyword, body, status, approval_mode, sent_at)
    values (${ws.id}, 'x', 'dm', 'old_friend', 'thanks', 'Thanks!', 'sent', 'auto', now())
    returning id`;

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

  // 1. suggest on draft DM with link → buy intent + real link, no price
  let r = await post(`/api/dashboard/dm-inbox/${dmLink.id}/suggest`);
  check("suggest 200 (with link)", r.status === 200, `status=${r.status}`);
  check("intent buy_intent", r.body.intent === "buy_intent", `intent=${r.body.intent}`);
  check("engine honest", r.body.engine === "rules-v1", `engine=${r.body.engine}`);
  check("real tracked link included", (r.body.reply ?? "").includes("go.affiliateautopilot.app/abc123xyz"));
  check("no dollar price quoted", !/\$\d/.test(r.body.reply ?? ""), `reply="${(r.body.reply ?? "").slice(0, 50)}..."`);
  check("delivery sandbox", r.body.delivery === "sandbox", `delivery=${r.body.delivery}`);
  check("reasons present", Array.isArray(r.body.reasons) && r.body.reasons.length >= 1, `n=${r.body.reasons?.length}`);

  // 2. suggestion did NOT mutate the body (read-only contract)
  let list = await (await fetch(`${BASE}/api/dashboard/dm-inbox`, { headers: { cookie: cookieHeader() } })).json();
  const original = (list.messages ?? []).find((m) => m.id === dmLink.id);
  check("body unchanged after suggest", original?.body?.includes("{{link}}"), `body="${(original?.body ?? "").slice(0, 40)}..."`);

  // 3. queued DM without link → question intent, no invented link
  r = await post(`/api/dashboard/dm-inbox/${dmNoLink.id}/suggest`);
  check("suggest 200 (no link)", r.status === 200, `status=${r.status}`);
  check("intent question", r.body.intent === "question", `intent=${r.body.intent}`);
  check("no invented link", !(r.body.reply ?? "").includes("http"), `reply="${(r.body.reply ?? "").slice(0, 60)}..."`);
  check("reason says none invented", (r.body.reasons ?? []).join(" ").includes("none was invented"));

  // 4. sent DM → 400
  r = await post(`/api/dashboard/dm-inbox/${dmSent.id}/suggest`);
  check("sent DM rejected (400)", r.status === 400, `status=${r.status} err="${r.body.error}"`);

  // 5. unknown id → 404
  r = await post(`/api/dashboard/dm-inbox/00000000-0000-0000-0000-000000000000/suggest`);
  check("unknown DM 404", r.status === 404, `status=${r.status}`);

  // 6. unauthenticated → 401
  res = await fetch(`${BASE}/api/dashboard/dm-inbox/${dmLink.id}/suggest`, { method: "POST" });
  check("unauthenticated 401", res.status === 401, `status=${res.status}`);

  // 7. DM inbox page renders (header is SSR; the list + AI suggest button
  //    hydrate client-side after data load, so button presence is checked
  //    in the shipped source below)
  res = await fetch(`${BASE}/dashboard/dm-inbox`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("dm inbox page loads", res.status === 200, `status=${res.status}`);
  check("dm inbox header in HTML", html.includes("DM Inbox"));
  const clientSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "app", "(app)", "dashboard", "dm-inbox", "dm-inbox-client.tsx"),
    "utf8",
  );
  check("AI suggest button wired in client", clientSrc.includes("AI suggest") && clientSrc.includes("/suggest"));

  await sql.end();
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("DM SUGGEST VERIFY ERROR:", e.message);
  process.exit(1);
});
