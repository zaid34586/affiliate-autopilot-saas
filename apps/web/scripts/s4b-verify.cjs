// S4b verify: dashboard/videos renders real UI + products API GET/POST work
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
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });
  const email = `s4b-verify-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("Test1234!", 10);
  const [u] = await sql`
    insert into users (email, name, password_hash, auth_provider)
    values (${email}, ${"S4B Verify"}, ${hash}, 'credentials')
    returning id`;

  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email, password: "Test1234!", csrfToken, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  absorb(res);
  check("login", res.status < 400, `status=${res.status}`);

  // 1. videos page renders the real UI (no skeleton)
  res = await fetch(`${BASE}/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const html = await res.text();
  check("videos page 200", res.status === 200, `status=${res.status}`);
  check("page has 'Create a video'", html.includes("Create a video"));
  check("page has 'Render queue'", html.includes("Render queue"));
  check("page has 'Generate video'", html.includes("Generate video"));
  check("no skeleton marker", !html.includes("not wired yet"));

  // 2. products API: empty list
  res = await fetch(`${BASE}/api/dashboard/products`, { headers: { cookie: cookieHeader() } });
  let data = await res.json();
  check("GET products 200", res.status === 200 && Array.isArray(data.products), `count=${data.products?.length}`);

  // 3. POST create product
  res = await fetch(`${BASE}/api/dashboard/products`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ title: "S4B Test Earbuds", price: "39.99", category: "electronics", rating: "4.4", reviewCount: 210 }),
  });
  data = await res.json();
  check("POST product 201", res.status === 201 && data.product?.id, JSON.stringify(data).slice(0, 120));

  // 4. validation: bad rating rejected
  res = await fetch(`${BASE}/api/dashboard/products`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ title: "Bad Rating Product", rating: "9" }),
  });
  check("POST invalid rating 400", res.status === 400);

  // 5. list now shows it
  res = await fetch(`${BASE}/api/dashboard/products`, { headers: { cookie: cookieHeader() } });
  data = await res.json();
  check("product appears in list", data.products?.some((p) => p.title === "S4B Test Earbuds"), `count=${data.products?.length}`);

  // 6. preview script with the new product (fact-safe copy)
  res = await fetch(`${BASE}/api/dashboard/videos/script`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ productId: data.products.find((p) => p.title === "S4B Test Earbuds").id, mode: "showcase" }),
  });
  const prev = await res.json();
  const text = JSON.stringify(prev);
  check("script preview 200 + 5–6 scenes", res.status === 200 && prev.sceneCount >= 5 && prev.sceneCount <= 6, `scenes=${prev.sceneCount}`);
  check("script states real price 39.99", text.includes("39.99"));
  check("script states real rating 4.4", text.includes("4.4"));

  // 7. budget API
  res = await fetch(`${BASE}/api/dashboard/videos/budget`, { headers: { cookie: cookieHeader() } });
  const budget = await res.json();
  check(
    "GET budget 200 + shape",
    res.status === 200 &&
      budget.plan === "free" &&
      budget.monthly.limit === 2 &&
      budget.today.renderCap === 1 &&
      typeof budget.today.breakerTripped === "boolean" &&
      typeof budget.providerMode === "string" &&
      budget.topupPack.videos === 10 &&
      budget.topupPack.priceUsd === 19,
    JSON.stringify(budget).slice(0, 200)
  );

  // 8. videos page still renders after the budget additions
  res = await fetch(`${BASE}/dashboard/videos`, { headers: { cookie: cookieHeader() } });
  const html2 = await res.text();
  check("videos page still 200", res.status === 200 && html2.includes("Render queue"), `status=${res.status}`);

  // cleanup
  const [ws] = await sql`select id from workspaces where owner_user_id = ${u.id}`;
  if (ws) await sql`delete from workspaces where id = ${ws.id}`;
  await sql`delete from users where id = ${u.id}`;
  await sql.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("S4B VERIFY ERROR:", e.message);
  process.exit(1);
});
