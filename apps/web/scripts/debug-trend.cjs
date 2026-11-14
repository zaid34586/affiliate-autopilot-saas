// Debug trend-miner POST
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
  const email = `debug-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`insert into users (email, name, password_hash, auth_provider) values (${email}, ${"Debug"}, ${hash}, 'credentials') returning id`;
  const [ws] = await sql`insert into workspaces (owner_user_id, name) values (${u.id}, 'Debug WS') returning id`;
  await sql`insert into workspace_members (workspace_id, user_id, role) values (${ws.id}, ${u.id}, 'owner')`;
  await sql`insert into characters (workspace_id, name, bio) values (${ws.id}, 'debug_ajju', 'Test')`;
  await sql`insert into brand_profiles (workspace_id, niche, tone) values (${ws.id}, 'fitness', 'friendly')`;

  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email, password: "Test1234!", csrfToken, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  absorb(res);

  const r = await post(`/api/dashboard/trend-miner`);
  console.log("STATUS:", r.status);
  console.log("BODY:", JSON.stringify(r.body, null, 2));

  await sql.end();
})().catch(e => console.error(e));