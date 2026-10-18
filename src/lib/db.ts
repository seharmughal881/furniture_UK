import "server-only";
import { Pool } from "pg";

// Reuse one pool across hot reloads in development.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

// On Vercel each function instance gets its own pool, so keep it small and let idle
// connections close quickly; use the provider's *pooled* connection string (e.g. Neon's
// "-pooler" host). SSL comes from the connection string (?sslmode=require).
const onVercel = !!process.env.VERCEL;

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: onVercel ? 5 : 10,
    idleTimeoutMillis: onVercel ? 5_000 : 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;
