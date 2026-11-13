/* E2E login test against production */
const BASE = process.env.BASE_URL || "https://web-match-mind-ai-s-projects.vercel.app";

async function main() {
  const jar = new Map();
  const getCookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const absorb = (res) => {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of sc) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };

  // 1. CSRF
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: getCookie() }, redirect: "manual" });
  absorb(csrfRes);
  const csrfJson = await csrfRes.json();
  console.log("1. CSRF token: " + (csrfJson.csrfToken ? "OK" : "FAIL"));

  // 2. Credentials login
  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: "demo@example.com",
    password: "Demo1234!",
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: getCookie() },
    body: body.toString(),
    redirect: "manual",
  });
  absorb(loginRes);
  const loginText = await loginRes.text();
  console.log("2. Login POST => " + loginRes.status + " body=" + loginText.slice(0, 120));

  // 3. Session check
  const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: getCookie() } });
  const sess = await sessRes.json();
  const ok = sess && sess.user;
  console.log("3. Session: " + (ok ? "OK user=" + (sess.user.email || "") + " workspaceId=" + (sess.workspaceId || "n/a") : "FAIL " + JSON.stringify(sess).slice(0, 100)));

  // 4. Dashboard with session
  const dashRes = await fetch(`${BASE}/dashboard`, { headers: { cookie: getCookie() }, redirect: "manual" });
  console.log("4. /dashboard (authed) => " + dashRes.status + " location=" + (dashRes.headers.get("location") || "-"));

  // 5. DB-backed API: DM inbox
  const dmRes = await fetch(`${BASE}/api/dashboard/dm-inbox`, { headers: { cookie: getCookie() } });
  const dmText = await dmRes.text();
  console.log("5. /api/dashboard/dm-inbox => " + dmRes.status + " body=" + dmText.slice(0, 150));

  // 6. Connections API (DB read)
  const connRes = await fetch(`${BASE}/api/dashboard/connections`, { headers: { cookie: getCookie() } });
  console.log("6. /api/dashboard/connections => " + connRes.status + " body=" + (await connRes.text()).slice(0, 150));

  const pass = ok && dashRes.status === 200 && dmRes.status === 200 && connRes.status === 200;
  console.log(pass ? "\nALL_PROD_CHECKS_PASS" : "\nSOME_CHECKS_FAILED");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("ERR " + e.message); process.exit(1); });
