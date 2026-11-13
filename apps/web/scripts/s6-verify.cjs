// S6 verify: auto-post flow (sandbox) + render + post status UI
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
  const email = `s6-verify-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"S6 Verify"}, ${hash}, 'credentials')
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

  // 1. Create a product
  res = await fetch(`${BASE}/api/dashboard/products`, {
    method: "POST", headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ title: "S6 Test Headphones", price: "79.99", category: "audio", rating: "4.5", reviewCount: 320 }),
  });
  const prod = await res.json();
  check("create product", res.status === 201 && prod.product?.id, prod.product?.id);
  const productId = prod.product.id;

  // 2. Generate video with autoPostPlatform=instagram (sandbox mode)
  res = await fetch(`${BASE}/api/dashboard/videos`, {
    method: "POST", headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ productId, mode: "showcase", autoPostPlatform: "instagram" }),
  });
  const enq = await res.json();
  check("enqueue with autoPostPlatform", res.status === 201 && enq.videoId, `vid=${enq.videoId}`);
  const videoId = enq.videoId;

  // 3. Wait for render to complete (poll /api/cron/render locally)
  let done = false;
  for (let i = 0; i < 60 && !done; i++) {
    await new Promise(r => setTimeout(r, 2000));
    res = await fetch(`${BASE}/api/cron/render`, { method: "POST", headers: { cookie: cookieHeader() } });
    const summ = await res.json();
    // check video status
    const vres = await fetch(`${BASE}/api/dashboard/videos`, { headers: { cookie: cookieHeader() } });
    const vdata = await vres.json();
    const vid = vdata.videos.find(v => v.id === videoId);
    if (vid?.renderStatus === "done") { done = true; check("render completed", true, `duration=${vid.durationSec}s`); }
    else if (vid?.renderStatus === "failed") { check("render failed", false, vid.failureReason); break; }
  }
  if (!done) check("render timeout", false, "did not reach done in 120s");

  // 4. Verify video has autoPostPlatform stored
  const vres2 = await fetch(`${BASE}/api/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const vdata2 = await vres2.json();
  const vid2 = vdata2.videos.find(v => v.id === videoId);
  check("video.autoPostPlatform stored", vid2?.autoPostPlatform === "instagram", `got=${vid2?.autoPostPlatform}`);

  // Wait a moment for auto-post to complete (it's awaited in pipeline but double-check)
  await new Promise(r => setTimeout(r, 1000));

  // 5. Verify a sandbox post was created (auto-post runs after render)
  const vres2b = await fetch(`${BASE}/api/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const vdata2b = await vres2b.json();
  const vid2b = vdata2b.videos.find(v => v.id === videoId);
  check("sandbox post created", Array.isArray(vid2b?.posts) && vid2b.posts.some(p => p.platform === "instagram" && p.sandbox === true), `posts=${JSON.stringify(vid2b?.posts)}`);

  // 6. Manual post to YouTube (sandbox)
  res = await fetch(`${BASE}/api/dashboard/videos/${videoId}/post`, {
    method: "POST", headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ platform: "youtube" }),
  });
  const postRes = await res.json();
  check("manual post youtube sandbox", res.status === 200 && postRes.success === true && postRes.sandbox === true, JSON.stringify(postRes).slice(0, 200));

  // 7. Verify posts array now has both instagram (auto) + youtube (manual)
  const vres3 = await fetch(`${BASE}/api/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const vdata3 = await vres3.json();
  const vid3 = vdata3.videos.find(v => v.id === videoId);
  const ig = vid3?.posts?.find(p => p.platform === "instagram");
  const yt = vid3?.posts?.find(p => p.platform === "youtube");
  check("ig post status", ig?.status === "published" && ig?.sandbox === true, JSON.stringify(ig));
  check("yt post status", yt?.status === "published" && yt?.sandbox === true, JSON.stringify(yt));

  // 8. Verify download URL works
  res = await fetch(`${BASE}/api/dashboard/videos/${videoId}/file?type=final`, { headers: { cookie: cookieHeader() } });
  check("download url works", res.status === 200 && res.headers.get("content-type")?.includes("video/mp4"), `ct=${res.headers.get("content-type")}`);

  // cleanup
  const [ws] = await sql`select id from workspaces where owner_user_id = ${u.id}`;
  if (ws) await sql`delete from workspaces where id = ${ws.id}`;
  await sql`delete from users where id = ${u.id}`;
  await sql.end();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("S6 VERIFY ERROR:", e.message); process.exit(1); });