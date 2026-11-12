import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@aa/db";

// Supabase session pooler (IPv4) ke liye prepare:false zaroori hai
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL missing — apps/web/.env.local check karo");
}

// HMR ke during connection explosion rokne ke liye global cache
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createClient(url: string) {
  return postgres(url, {
    ssl: "require",
    prepare: false,
    max: 10,
    connect_timeout: 15,
  });
}

const client = globalForDb._pgClient ?? createClient(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = globalForDb._db ?? drizzle(client, { schema });

export type Db = typeof db;
