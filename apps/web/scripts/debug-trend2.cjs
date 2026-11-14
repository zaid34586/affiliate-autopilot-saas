// Debug trend analysis step by step
const fs = require("fs");
const path = require("path");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;

const rootEnv = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = rootEnv.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const sql = postgres(url, { ssl: "require", prepare: false, connect_timeout: 15 });

(async () => {
  // Check what data exists
  const hashtags = await sql`select * from trending_hashtags`;
  console.log("HASHTAGS:", hashtags.length);
  
  const audio = await sql`select * from trending_audio`;
  console.log("AUDIO:", audio.length);
  
  const viral = await sql`select * from viral_posts`;
  console.log("VIRAL:", viral.length);
  
  const products = await sql`select * from products where workspace_id = (select id from workspaces where name = 'Debug WS')`;
  console.log("PRODUCTS:", products.length);
  
  const brand = await sql`select niche from brand_profiles where workspace_id = (select id from workspaces where name = 'Debug WS')`;
  console.log("BRAND NICHE:", brand);
  
  // Check the scoring
  const hashtags2 = await sql`select * from trending_hashtags`;
  for (const h of hashtags2) {
    console.log("HASHTAG:", h.hashtag, "vol:", h.volume, "vel:", h.velocity, "niche:", h.niche);
  }
  
  await sql.end();
})().catch(e => console.error(e));