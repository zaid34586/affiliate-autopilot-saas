// Seed: demo user + workspace + brand + character (idempotent)
const fs = require("fs");
const path = require("path");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const bcryptMod = require("bcryptjs");
const bcrypt = bcryptMod.default || bcryptMod;

const rootEnv = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", ".env.local"),
  "utf8",
);
const DB_URL = rootEnv.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const DEMO_EMAIL = process.env.SEED_EMAIL ?? "demo@example.com";
const DEMO_PASS = process.env.SEED_PASSWORD ?? "Demo1234!";
const DEMO_HANDLE = process.env.SEED_HANDLE ?? "fitwithrohit";

(async () => {
  const sql = postgres(DB_URL, { ssl: "require", prepare: false, connect_timeout: 15 });

  const existing = await sql`select id from users where email = ${DEMO_EMAIL}`;
  let userId;
  if (existing[0]) {
    userId = existing[0].id;
    console.log("user already exists:", DEMO_EMAIL);
  } else {
    const hash = await bcrypt.hash(DEMO_PASS, 10);
    const [u] = await sql`
      insert into users (email, name, password_hash, auth_provider)
      values (${DEMO_EMAIL}, ${"Demo User"}, ${hash}, 'credentials')
      returning id`;
    userId = u.id;
    console.log("user created:", DEMO_EMAIL, "(password:", DEMO_PASS + ")");
  }

  // workspace (only if none)
  const wsRows = await sql`select id from workspaces where owner_user_id = ${userId}`;
  let wsId;
  if (wsRows[0]) {
    wsId = wsRows[0].id;
    console.log("workspace already exists");
  } else {
    const [ws] = await sql`
      insert into workspaces (name, owner_user_id)
      values (${"Demo Workspace"}, ${userId})
      returning id`;
    wsId = ws.id;
    console.log("workspace created: Demo Workspace");
  }

  await sql`
    insert into workspace_members (workspace_id, user_id, role)
    values (${wsId}, ${userId}, 'owner')
    on conflict (workspace_id, user_id) do nothing`;

  await sql`
    insert into autopilot_config (workspace_id, level)
    values (${wsId}, 'manual')
    on conflict (workspace_id) do nothing`;

  await sql`
    insert into brand_profiles (workspace_id, niche, tone, languages)
    values (${wsId}, ${"Fitness"}, ${"Friendly"}, ${JSON.stringify(["en", "hi"])})
    on conflict (workspace_id) do nothing`;

  await sql`
    insert into characters (workspace_id, name, bio)
    values (${wsId}, ${DEMO_HANDLE}, ${"@" + DEMO_HANDLE + " — AI affiliate persona (fitness)"})
    on conflict (workspace_id) do nothing`;

  console.log("seed complete ✓ — login:", DEMO_EMAIL, "/", DEMO_PASS);
  await sql.end();
})().catch((e) => {
  console.error("SEED FAIL:", e.message);
  process.exit(1);
});
