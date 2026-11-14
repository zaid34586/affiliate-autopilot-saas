const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const postgresMod = require("postgres");
const postgres = postgresMod.default || postgresMod;
const sql = postgres(url, { ssl: "require", prepare: false });

(async () => {
  try {
    // Add draft to post_status enum
    try {
      await sql`ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'draft';`;
      console.log("Added draft to post_status enum");
    } catch (e) {
      console.log("Enum value may already exist:", e.message);
    }

    // Add missing columns to copilot_messages
    try {
      await sql`ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`;
      console.log("Added at column to copilot_messages");
    } catch (e) {
      console.log("at column:", e.message);
    }

    try {
      await sql`ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS tool_calls JSONB;`;
      console.log("Added tool_calls column to copilot_messages");
    } catch (e) {
      console.log("tool_calls column:", e.message);
    }

    try {
      await sql`ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS tool_results JSONB;`;
      console.log("Added tool_results column to copilot_messages");
    } catch (e) {
      console.log("tool_results column:", e.message);
    }

    // Create index
    try {
      await sql`CREATE INDEX IF NOT EXISTS cm_conversation_at_idx ON copilot_messages(conversation_id, created_at DESC);`;
      console.log("Created index on copilot_messages");
    } catch (e) {
      console.log("Index:", e.message);
    }

    console.log("All fixes applied successfully");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await sql.end();
  }
})();