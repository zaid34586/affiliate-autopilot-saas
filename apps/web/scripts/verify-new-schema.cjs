const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const sql = postgres(url, { ssl: "require", prepare: false, connect_timeout: 15 });
(async () => {
  const tables = ["whatsapp_links", "dm_triggers"];
  for (const t of tables) {
    const r = await sql`select column_name, data_type from information_schema.columns where table_name = ${t} order by ordinal_position`;
    console.log(t.toUpperCase() + ":", r.map((x) => x.column_name + ":" + x.data_type).join(", "));
  }
  const enums = await sql`select t.typname, string_agg(x.enumlabel, ',' order by x.enumsortorder) as labels from pg_type t join pg_enum x on x.enumtypid = t.oid where t.typname in ('trigger_platform', 'trigger_source') group by t.typname`;
  console.log("ENUMS:", JSON.stringify(enums));
  await sql.end();
})().catch((e) => console.error(e.message));