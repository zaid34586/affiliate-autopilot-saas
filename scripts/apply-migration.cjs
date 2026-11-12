// Apply migration SQL via Supabase Management API
const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
const TOKEN = get("SUPABASE_ACCESS_TOKEN");
const REF = "txoydqeayocgqhgnjjvh";

const sqlFile = process.argv[2];
const sql = fs.readFileSync(sqlFile, "utf8");

(async () => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESP:", text.substring(0, 1200));
  process.exit(res.ok ? 0 : 1);
})();
