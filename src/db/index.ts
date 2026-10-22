import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlUrl?: string;
};

const isRemoteDb =
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("supabase.com") ||
  databaseUrl.includes("pooler.supabase.com") ||
  databaseUrl.includes("sslmode=");

if (
  globalForDb.__arenaNextJsPostgresqlPool &&
  globalForDb.__arenaNextJsPostgresqlUrl !== databaseUrl
) {
  globalForDb.__arenaNextJsPostgresqlPool.end().catch(() => {});
  globalForDb.__arenaNextJsPostgresqlPool = undefined;
}

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  globalForDb.__arenaNextJsPostgresqlUrl = databaseUrl;
}

export const db = drizzle(pool);
