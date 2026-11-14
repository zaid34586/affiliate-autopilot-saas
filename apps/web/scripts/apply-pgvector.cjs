const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const sql = postgres(url, { ssl: "require", prepare: false });

(async () => {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("pgvector extension created/verified");

    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('performance_embeddings', 'ai_reports', 'ab_test_winners', 'report_schedules')`;
    console.log("Tables found:", tables);

    if (tables.length < 4) {
      console.log("Some tables missing, applying migration...");
      const migration = fs.readFileSync(path.join(__dirname, "..", "..", "..", "packages", "db", "migrations", "0015_aromatic_thunderbird.sql"), "utf8");
      const statements = migration.split("--> statement-breakpoint").filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            await sql.unsafe(stmt);
            console.log("Applied statement");
          } catch (e) {
            console.error("Error applying:", e.message);
          }
        }
      }
      console.log("Migration applied");
    }

    const tables2 = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('performance_embeddings', 'ai_reports', 'ab_test_winners', 'report_schedules')`;
    console.log("Tables after:", tables2);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await sql.end();
  }
})();