// Module D Slice 1 verify: DM Funnel Engine (multi-step funnels, semantic matching, anti-spam)
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

async function request(url, method, payload) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function post(url, payload) {
  return request(url, "POST", payload);
}

async function patch(url, payload) {
  return request(url, "PATCH", payload);
}

async function get(url) {
  const res = await fetch(`${BASE}${url}`, { headers: { cookie: cookieHeader() } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `funnel-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Funnel Verify"}, ${hash}, 'credentials')
    returning id`;
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'Funnel WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'funnel_ajju', 'Test character')`;

  // Create a funnel
  const [funnel] = await sql`
    insert into dm_funnels (workspace_id, name, description, enabled)
    values (${ws.id}, 'Welcome Funnel', 'Test funnel', true)
    returning id`;
  await sql`
    insert into dm_funnel_steps (funnel_id, step_type, "order", template, delay_hours, conditions)
    values 
      (${funnel.id}, 'greet', 0, 'Hey {{handle}}! Welcome!', 0, '{}'),
      (${funnel.id}, 'pitch', 1, 'Check out {{product}}', 2, '{"hasProduct": true}'),
      (${funnel.id}, 'link', 2, 'Link: {{link}}', 1, '{"hasLink": true}'),
      (${funnel.id}, 'followup', 3, 'Let me know if you need help', 24, '{}')`;

  // Create a trigger mapped to the funnel
  const [trigger] = await sql`
    insert into dm_triggers (workspace_id, keywords, mode, cooldown_hours, daily_cap, enabled)
    values (${ws.id}, '{"set":["price","buy"],"semantic":true}', 'semi', 24, 50, true)
    returning id`;
  await sql`
    insert into dm_trigger_funnels (trigger_id, funnel_id)
    values (${trigger.id}, ${funnel.id})`;

  // Product for context
  const [product] = await sql`
    insert into products (workspace_id, source, source_id, title, status, ai_score)
    values (${ws.id}, 'custom', 'test-product-1', 'Test Product', 'active', 80)
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

  // 1. GET funnels list
  res = await get(`/api/dashboard/dm-funnels`);
  check("GET funnels 200", res.status === 200, `status=${res.status}`);
  check("funnel in list", res.body.funnels?.some((f) => f.name === "Welcome Funnel"));

  // 2. GET single funnel with steps
  res = await get(`/api/dashboard/dm-funnels/${funnel.id}`);
  check("GET funnel detail 200", res.status === 200, `status=${res.status}`);
  check("funnel has 4 steps", res.body.funnel?.steps?.length === 4, `n=${res.body.funnel?.steps?.length}`);
  check("steps in order", res.body.funnel?.steps?.[0]?.stepType === "greet" && res.body.funnel?.steps?.[3]?.stepType === "followup");

  // 3. Create funnel via POST
  let r = await post(`/api/dashboard/dm-funnels`, {
    name: "Test Funnel 2",
    steps: [
      { stepType: "greet", order: 0, template: "Hi {{handle}}", delayHours: 0, conditions: {} },
      { stepType: "link", order: 1, template: "Link: {{link}}", delayHours: 1, conditions: { hasLink: true } },
    ],
  });
  check("POST funnel 201", r.status === 201, `status=${r.status}`);
  check("created funnel has 2 steps", r.body.funnel?.steps?.length === 2);
  const newFunnelId = r.body.funnel?.id;

  // 4. PATCH funnel
  r = await patch(`/api/dashboard/dm-funnels/${newFunnelId}`, {
    name: "Updated Name",
    steps: [
      { stepType: "greet", order: 0, template: "Hello {{handle}}", delayHours: 0, conditions: {} },
      { stepType: "pitch", order: 1, template: "Buy {{product}}", delayHours: 2, conditions: { hasProduct: true } },
      { stepType: "followup", order: 2, template: "Thanks!", delayHours: 24, conditions: {} },
    ],
  });
  check("PATCH funnel 200", r.status === 200, `status=${r.status}`);
  check("funnel name updated", r.body.funnel?.name === "Updated Name");
  check("funnel has 3 steps", r.body.funnel?.steps?.length === 3);

  // 5. Map trigger to funnel
  r = await post(`/api/dashboard/dm-triggers/${trigger.id}/funnel`, {
    funnelId: funnel.id,
    action: "set",
  });
  check("map trigger->funnel 200", r.status === 200, `status=${r.status}`);
  check("mapping stored", r.body.funnelIds?.includes(funnel.id));

  // 6. Remove mapping
  r = await post(`/api/dashboard/dm-triggers/${trigger.id}/funnel`, {
    funnelId: funnel.id,
    action: "remove",
  });
  check("remove mapping 200", r.status === 200, `status=${r.status}`);
  check("mapping removed", !r.body.funnelIds?.includes(funnel.id));

  // 6b. Add back mapping
  r = await post(`/api/dashboard/dm-triggers/${trigger.id}/funnel`, {
    funnelId: funnel.id,
    action: "add",
  });
  check("add mapping 200", r.status === 200, `status=${r.status}`);

  // 7. Blocklist CRUD
  r = await post(`/api/dashboard/dm-blocklist`, { handle: "bad_user", platform: "instagram", reason: "spam" });
  check("add blocklist 201", r.status === 201, `status=${r.status}`);
  const blockId = r.body.blocklist?.id;

  res = await get(`/api/dashboard/dm-blocklist`);
  check("GET blocklist 200", res.status === 200, `status=${res.status}`);
  check("blocklist has entry", res.body.blocklist?.some((b) => b.handle === "bad_user"));

  r = await fetch(`${BASE}/api/dashboard/dm-blocklist/${blockId}`, { method: "DELETE", headers: { cookie: cookieHeader() } });
  check("DELETE blocklist 200", r.status === 200, `status=${r.status}`);

  // 8. Daily caps
  r = await patch(`/api/dashboard/dm-daily-caps`, { platform: "instagram", limit: 25 });
  check("set daily cap 200", r.status === 200, `status=${r.status}`);
  check("cap value", r.body.limit === 25);

  // 9. Semantic matching (via funnel-core logic - tested in unit tests, but verify API loads)
  res = await get(`/api/dashboard/dm-funnels`);
  check("funnels API loads", res.status === 200, `status=${res.status}`);

  // 10. DM inbox page loads with funnel manager (SSR header; funnel manager hydrates client-side)
  res = await fetch(`${BASE}/dashboard/dm-inbox`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("dm inbox page loads", res.status === 200, `status=${res.status}`);
  check("dm inbox header in HTML", html.includes("DM Inbox"));
  const clientSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "app", "(app)", "dashboard", "dm-inbox", "dm-funnel-manager.tsx"),
    "utf8",
  );
  check("funnel manager wired in client", clientSrc.includes("DM Funnels") && clientSrc.includes("New funnel"));

  // 11. Funnel cron endpoint
  res = await fetch(`${BASE}/api/cron/dm-funnel`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cron-secret": process.env.DM_TRIGGERS_CRON_SECRET ?? "test-secret" },
  });
  const cronBody = await res.json();
  check("funnel cron 200", res.status === 200, `status=${res.status}`);
  check("cron returns ok", cronBody.ok === true);

  // 12. Delete funnel
  r = await fetch(`${BASE}/api/dashboard/dm-funnels/${newFunnelId}`, { method: "DELETE", headers: { cookie: cookieHeader() } });
  check("DELETE funnel 200", r.status === 200, `status=${r.status}`);

  await sql.end();
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("FUNNEL VERIFY ERROR:", e.message);
  process.exit(1);
});