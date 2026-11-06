import "server-only";
import { Pool } from "pg";

// Reuse one pool across hot reloads in development.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

// On Vercel each function instance gets its own pool, so keep it small and let idle
// connections close quickly; use the provider's *pooled* connection string (e.g. Neon's
// "-pooler" host). SSL comes from the connection string (?sslmode=require).
const onVercel = !!process.env.VERCEL;

/**
 * Fail fast, and say what to do about it.
 *
 * With no connection string `pg` silently falls back to libpq's defaults -- localhost,
 * and the OS username as the database role. The first query then dies deep inside a
 * "use cache" boundary with `role "<your-username>" does not exist`, which says nothing
 * about the actual cause. scripts/db-setup.ts already checks this up front; the app did
 * not.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set, so there is nothing to connect to. Copy .env.example to .env.local and set it, e.g. "postgresql://postgres@127.0.0.1:5432/muscat_furniture", then run `npm run db:setup`.',
  );
}

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: onVercel ? 5 : 10,
    idleTimeoutMillis: onVercel ? 5_000 : 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;
