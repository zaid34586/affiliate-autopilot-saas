// Debug GET and PATCH
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

async function request(method, url, payload) {
  const res = await fetch(`${BASE}${url}`, {
    method,
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
  const [p1] = await sql`insert into products (workspace_id, source, source_id, title, status, ai_score, commission_type, commission_value, category) values (${ws.id}, 'custom', 'p1', 'Resistance Bands Pro', 'active', 85, 'percentage', '15', 'fitness') returning id`;
  const [p2] = await sql`insert into products (workspace_id, source, source_id, title, status, ai_score, commission_type, commission_value, category) values (${ws.id}, 'custom', 'p2', 'Yoga Mat Premium', 'active', 75, 'flat', '10', 'fitness') returning id`;
  await sql`insert into trending_hashtags (workspace_id, platform, hashtag, volume, velocity, niche, source) values (${ws.id}, 'instagram', '#fitness', 50000, 15, 'fitness', 'api'), (${ws.id}, 'tiktok', '#workout', 30000, 8, 'fitness', 'api'), (${ws.id}, 'x', '#tech', 20000, 5, 'technology', 'api')`;
  await sql`insert into trending_audio (workspace_id, platform, audio_id, title, artist, usage_count, velocity, source) values (${ws.id}, 'instagram', 'audio1', 'Workout Beat', 'DJ Fit', 5000, 20, 'api'), (${ws.id}, 'tiktok', 'audio2', 'Gym Motivation', 'Coach Mike', 3000, 10, 'api')`;
  await sql`insert into viral_posts (workspace_id, platform, platform_post_id, author_handle, caption, hashtags, audio_id, views, likes, comments, shares, engagement_rate, affiliate_links, niche) values (${ws.id}, 'instagram', 'post1', 'fit_influencer', 'My resistance band routine!', '["#fitness","#workout","#resistancebands"]', 'audio1', 100000, 5000, 200, 100, 0.053, '["go.affiliateautopilot.app/abc123"]', 'fitness'), (${ws.id}, 'tiktok', 'post2', 'gym_bro', 'Yoga flow for beginners', '["#yoga","#flexibility"]', null, 50000, 2000, 50, 20, 0.041, '[]', 'fitness')`;

  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email, password: "Test1234!", csrfToken, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  absorb(res);

  // Run analysis
  let r = await request("POST", `/api/dashboard/trend-miner`);
  console.log("POST result:", JSON.stringify(r.body, null, 2));

  // GET suggestions
  r = await request("GET", `/api/dashboard/trend-miner`);
  console.log("GET suggestions:", JSON.stringify(r.body, null, 2));

  // Try PATCH approve
  if (r.body.suggestions && r.body.suggestions.length > 0) {
    const id = r.body.suggestions[0].id;
    console.log("Trying to approve:", id);
    r = await request("PATCH", `/api/dashboard/trend-miner/${id}`, { action: "approve" });
    console.log("PATCH approve:", r.status, JSON.stringify(r.body, null, 2));
  }

  await sql.end();
})().catch(e => console.error(e));

async function request(method, url, payload) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}