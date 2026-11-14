const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const sql = postgres(url, { ssl: "require", prepare: false, connect_timeout: 15 });
(async () => {
  const tables = ["dm_funnels", "dm_funnel_steps", "dm_trigger_funnels", "dm_conversations", "dm_blocklist", "dm_daily_caps"];
  for (const t of tables) {
    const r = await sql`select count(*)::int as c from ${sql(t)}`;
    console.log(t, r[0].c);
  }
  await sql.end();
})().catch((e) => console.error(e.message));