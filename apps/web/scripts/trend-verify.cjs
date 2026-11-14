// Module E Slice 1 verify: Trend Miner (trending hashtags/audio, viral posts, remix suggestions)
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

async function get(url) {
  const res = await fetch(`${BASE}${url}`, { headers: { cookie: cookieHeader() } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `trend-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Trend Verify"}, ${hash}, 'credentials')
    returning id`;
  const [ws] = await sql`
    insert into workspaces (owner_user_id, name)
    values (${u.id}, 'Trend WS')
    returning id`;
  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${ws.id}, ${u.id}, 'owner')`;
  await sql`
    insert into characters (workspace_id, name, bio)
    values (${ws.id}, 'trend_ajju', 'Test character')`;
  await sql`
    insert into brand_profiles (workspace_id, niche, tone)
    values (${ws.id}, 'fitness', 'friendly')`;

  // Seed products
  const [p1] = await sql`
    insert into products (workspace_id, source, source_id, title, status, ai_score, commission_type, commission_value, category)
    values (${ws.id}, 'custom', 'p1', 'Resistance Bands Pro', 'active', 85, 'percentage', '15', 'fitness')
    returning id`;
  const [p2] = await sql`
    insert into products (workspace_id, source, source_id, title, status, ai_score, commission_type, commission_value, category)
    values (${ws.id}, 'custom', 'p2', 'Yoga Mat Premium', 'active', 75, 'flat', '10', 'fitness')
    returning id`;

  // Seed trending hashtags
  await sql`
    insert into trending_hashtags (workspace_id, platform, hashtag, volume, velocity, niche, source)
    values 
      (${ws.id}, 'instagram', '#fitness', 50000, 15, 'fitness', 'api'),
      (${ws.id}, 'tiktok', '#workout', 30000, 8, 'fitness', 'api'),
      (${ws.id}, 'x', '#tech', 20000, 5, 'technology', 'api')`;

  // Seed trending audio
  await sql`
    insert into trending_audio (workspace_id, platform, audio_id, title, artist, usage_count, velocity, source)
    values 
      (${ws.id}, 'instagram', 'audio1', 'Workout Beat', 'DJ Fit', 5000, 20, 'api'),
      (${ws.id}, 'tiktok', 'audio2', 'Gym Motivation', 'Coach Mike', 3000, 10, 'api')`;

  // Seed viral posts
  await sql`
    insert into viral_posts (workspace_id, platform, platform_post_id, author_handle, caption, hashtags, audio_id, views, likes, comments, shares, engagement_rate, affiliate_links, niche)
    values 
      (${ws.id}, 'instagram', 'post1', 'fit_influencer', 'My resistance band routine!', '["#fitness","#workout","#resistancebands"]', 'audio1', 100000, 5000, 200, 100, 0.053, '["go.affiliateautopilot.app/abc123"]', 'fitness'),
      (${ws.id}, 'tiktok', 'post2', 'gym_bro', 'Yoga flow for beginners', '["#yoga","#flexibility"]', null, 50000, 2000, 50, 20, 0.041, '[]', 'fitness')`;

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

  // 1. GET trend-miner (empty initially)
  res = await get(`/api/dashboard/trend-miner`);
  check("GET trend-miner 200", res.status === 200, `status=${res.status}`);
  check("empty suggestions initially", res.body.suggestions?.length === 0);

  // 2. POST trend-miner (run analysis)
  let r = await post(`/api/dashboard/trend-miner`);
  check("POST trend-miner 201", r.status === 201, `status=${r.status}`);
  check("suggestions created >= 1", (r.body.result?.suggestionsCreated ?? 0) >= 1, `n=${r.body.result?.suggestionsCreated}`);
  check("top hashtags returned", (r.body.result?.topHashtags?.length ?? 0) > 0);
  check("top audio returned", (r.body.result?.topAudio?.length ?? 0) > 0);
  check("top viral posts returned", (r.body.result?.topViralPosts?.length ?? 0) > 0);

  // 3. GET shows suggestions
  res = await get(`/api/dashboard/trend-miner`);
  check("GET shows pending suggestions", res.body.suggestions?.length >= 1, `n=${res.body.suggestions?.length}`);
  const suggestion = res.body.suggestions[0];
  check("suggestion has hookIdea", typeof suggestion?.hookIdea === "string" && suggestion.hookIdea.length > 0);
  check("suggestion has confidence 0-100", suggestion?.confidence >= 0 && suggestion.confidence <= 100);
  check("suggestion format valid", ["remix","reaction","tutorial","showcase"].includes(suggestion?.suggestedFormat));
  check("suggestion status pending", suggestion?.status === "pending");

  // 4. Approve suggestion
  const suggestionId = suggestion.id;
  r = await post(`/api/dashboard/trend-miner/${suggestionId}`, { action: "approve" });
  check("approve 200", r.status === 200, `status=${r.status}`);

  // 5. Verify approved
  res = await get(`/api/dashboard/trend-miner`);
  const approved = res.body.all?.find((s) => s.id === suggestionId);
  check("approved status", approved?.status === "approved");

  // 6. Reject another suggestion (if exists)
  const pending = res.body.suggestions.filter((s) => s.status === "pending");
  if (pending.length > 0) {
    r = await post(`/api/dashboard/trend-miner/${pending[0].id}`, { action: "reject" });
    check("reject 200", r.status === 200);
  }

  // 7. Mark as created
  const approved2 = res.body.all?.find((s) => s.status === "approved");
  if (approved2) {
    r = await post(`/api/dashboard/trend-miner/${approved2.id}`, { action: "create" });
    check("mark created 200", r.status === 200);
  }

  // 8. Trend Miner page loads
  res = await fetch(`${BASE}/dashboard/trend-miner`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  check("trend-miner page loads", res.status === 200);
  check("Trend Miner header in HTML", html.includes("Trend Miner"));
  check("Run Trend Analysis button in HTML", html.includes("Run Trend Analysis"));

  // 9. Verify schema tables exist
  const tables = ["trending_hashtags", "trending_audio", "viral_posts", "trend_remix_suggestions"];
  for (const t of tables) {
    const count = await sql`select count(*)::int as c from ${sql(t)}`;
    check(`table ${t} exists`, count[0].c >= 0, `rows=${count[0].c}`);
  }

  await sql.end();
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("TREND VERIFY ERROR:", e.message);
  process.exit(1);
});