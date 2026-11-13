// Render smoke: login → product → enqueue render → poll queue → verify MP4 + thumb + cost
// Run: node scripts/render-smoke.cjs   (dev server on localhost:3000 required)
const fs = require("fs");
const path = require("path");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const bcryptMod = require("bcryptjs");
const bcrypt = bcryptMod.default || bcryptMod;

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const rootEnv = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `render-smoke-${Date.now()}@test.dev`;
  const password = "Test1234!";

  // 1. user banao
  const hash = await bcrypt.hash(password, 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"Render Smoke"}, ${hash}, 'credentials')
    returning id`;

  // 2. login
  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  absorb(res);
  check("login", res.status < 400, `status=${res.status}`);

  // 3. workspace (jwt auto-provision) + product
  const [ws] = await sql`select id from workspaces where owner_user_id = ${u.id}`;
  check("workspace auto-created", Boolean(ws?.id));
  const [prod] = await sql`
    insert into products (workspace_id, source, title, price, currency, category, rating, review_count)
    values (${ws.id}, 'custom', ${"AeroRun Wireless Earbuds"}, ${"49.99"}, 'USD', 'electronics', '4.6', 1284)
    returning id`;
  check("product seeded", Boolean(prod?.id));

  // 4. quota preview endpoint
  res = await fetch(`${BASE}/api/dashboard/videos/script`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ productId: prod.id, mode: "showcase" }),
  });
  const preview = await res.json();
  check(
    "script preview: 5–6 scenes",
    res.status === 200 && preview.sceneCount >= 5 && preview.sceneCount <= 6,
    `scenes=${preview.sceneCount}, total=${preview.totalDurationSec}s`
  );

  // 5. enqueue render
  res = await fetch(`${BASE}/api/dashboard/videos`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ productId: prod.id, mode: "showcase" }),
  });
  const enq = await res.json();
  check("enqueue render (201)", res.status === 201 && Boolean(enq.videoId), JSON.stringify(enq).slice(0, 200));
  if (res.status !== 201) throw new Error("enqueue failed");

  // 6. poll queue status
  let video = null;
  const started = Date.now();
  let lastPct = -1;
  while (Date.now() - started < 180_000) {
    const r = await fetch(`${BASE}/api/dashboard/videos/${enq.videoId}`, {
      headers: { cookie: cookieHeader() },
    });
    const j = await r.json();
    video = j.video;
    if (video && video.progressPct !== lastPct) {
      lastPct = video.progressPct;
      console.log(`  … ${video.renderStatus} ${video.progressPct}%${video.failureReason ? ` (${video.failureReason})` : ""}`);
    }
    if (video && ["done", "failed"].includes(video.renderStatus)) break;
    await sleep(2000);
  }
  check("render reached done", video?.renderStatus === "done", `status=${video?.renderStatus} pct=${video?.progressPct}`);
  check("failure reason empty", !video?.failureReason, video?.failureReason ?? "");
  check("progress 100", video?.progressPct === 100);
  check("duration recorded (~20–35s)", (video?.durationSec ?? 0) >= 10 && (video?.durationSec ?? 0) <= 40, `${video?.durationSec}s`);
  check("cost tracked (cost_usd set)", video?.costUsd != null, `$${video?.costUsd}`);

  // 7. artifacts on disk
  const finalPath = path.join(__dirname, "..", ".renders", enq.videoId, "final.mp4");
  const thumbPath = path.join(__dirname, "..", ".renders", enq.videoId, "thumb.jpg");
  const finalOk = fs.existsSync(finalPath) && fs.statSync(finalPath).size > 30_000;
  const thumbOk = fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 2_000;
  check("final.mp4 on disk", finalOk, fs.existsSync(finalPath) ? `${fs.statSync(finalPath).size} bytes` : "missing");
  check("thumb.jpg on disk", thumbOk, fs.existsSync(thumbPath) ? `${fs.statSync(thumbPath).size} bytes` : "missing");

  // 8. MP4 signature (ftyp) via file route
  res = await fetch(`${BASE}/api/dashboard/videos/${enq.videoId}/file?type=final`, {
    headers: { cookie: cookieHeader() },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const sig = buf.subarray(4, 8).toString("latin1");
  check("file route streams MP4", res.status === 200 && sig === "ftyp", `status=${res.status} sig=${sig} bytes=${buf.length}`);

  res = await fetch(`${BASE}/api/dashboard/videos/${enq.videoId}/file?type=thumb`, {
    headers: { cookie: cookieHeader() },
  });
  const thumbBuf = Buffer.from(await res.arrayBuffer());
  check(
    "file route streams JPEG thumb",
    res.status === 200 && thumbBuf[0] === 0xff && thumbBuf[1] === 0xd8,
    `status=${res.status} bytes=${thumbBuf.length}`
  );

  // 9. list endpoint contains the video + jobs_audit row
  res = await fetch(`${BASE}/api/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const list = await res.json();
  check("list shows the render", list.videos?.some((v) => v.id === enq.videoId), `count=${list.videos?.length}`);
  const audit = await sql`
    select status, cost_usd from jobs_audit
    where job_type = 'video' and input->>'videoId' = ${enq.videoId}`;
  check("jobs_audit success + cost", audit[0]?.status === "success" && audit[0]?.cost_usd != null, JSON.stringify(audit[0] ?? {}));

  // 10. quota now shows 1/2 used (free plan trial)
  const used = await sql`
    select count(*)::int as n from videos
    where workspace_id = ${ws.id} and render_status <> 'failed'`;
  check("quota usage counted", used[0].n === 1, `used=${used[0].n}/2 (free trial)`);

  // cleanup (jobs_audit has no FK cascade — delete explicitly)
  await sql`delete from jobs_audit where input->>'videoId' = ${enq.videoId}`;
  await sql`delete from workspaces where owner_user_id = ${u.id}`;
  await sql`delete from users where id = ${u.id}`;
  await sql.end();
  fs.rmSync(path.join(__dirname, "..", ".renders", enq.videoId), { recursive: true, force: true });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("RENDER SMOKE ERROR:", e.message);
  process.exit(1);
});
