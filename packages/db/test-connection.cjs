const mod = require("postgres");
const postgres = mod.default || mod;

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("FAIL: DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url, { connect_timeout: 15, ssl: "require" });

sql`select 1 as ok`
  .then((r) => {
    console.log("CONNECT OK:", JSON.stringify(r));
    return sql`select count(*) as tables from information_schema.tables where table_schema='public'`;
  })
  .then((r) => {
    console.log("PUBLIC TABLES:", r[0].tables);
    process.exit(0);
  })
  .catch((e) => {
    console.log("CONNECT FAIL:", e.message);
    process.exit(1);
  });
