const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const sql = postgres(url, { ssl: "require", prepare: false, connect_timeout: 15 });
(async () => {
  const tables = ["ab_tests", "ab_test_results", "optimizer_state", "post_performance", "optimizer_decisions", "copilot_conversations", "copilot_messages", "performance_embeddings", "ai_reports", "ab_test_winners", "report_schedules"];
  for (const t of tables) {
    const r = await sql`select column_name, data_type from information_schema.columns where table_name = ${t} order by ordinal_position`;
    console.log(t.toUpperCase() + ":", r.map((x) => x.column_name + ":" + x.data_type).join(", "));
  }
  await sql.end();
})().catch((e) => console.error(e.message));