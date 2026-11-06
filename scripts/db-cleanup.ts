/**
 * Retention / cleanup. Run: npm run db:cleanup
 *
 * db/schema.sql has documented this script since the v6 section ("Retention: npm run
 * db:cleanup deletes abandoned carts and stale rows") and pointed at this filename, but it
 * was never written -- so rate_limits, carts/cart_items and expired admin_sessions grew
 * without bound. The carts_updated_idx and rate_limits_expires_idx indexes exist purely to
 * make these deletes cheap.
 *
 * Safe to run repeatedly, and safe to run while the site is serving: every statement
 * targets rows that are already expired or abandoned. Intended as a daily cron (on Vercel,
 * a Cron Job hitting a route that calls this, or a scheduled GitHub Action).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

/** How long an untouched basket is kept before it is treated as abandoned. */
const CART_DAYS = Number(process.env.CLEANUP_CART_DAYS ?? 30);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Fixed-window buckets are meaningless once expired; rate-limit.ts re-creates them.
    const limits = await pool.query(`DELETE FROM rate_limits WHERE expires_at < now()`);

    // Expired logins. currentAdmin() already refuses these, so deleting them only frees
    // space -- it signs nobody out.
    const sessions = await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);

    // Abandoned baskets. cart_items goes with them via ON DELETE CASCADE. A cart attached
    // to an order is already deleted at checkout, so nothing here touches order history.
    const carts = await pool.query(
      `DELETE FROM carts WHERE updated_at < now() - make_interval(days => $1)`,
      [CART_DAYS],
    );

    // Sign-ups that never confirmed. Nothing may be sent to them (only rows WHERE
    // confirmed are mailable), so an unconfirmed row older than a week is dead weight.
    const pending = await pool.query(
      `DELETE FROM newsletter WHERE NOT confirmed AND created_at < now() - interval '7 days'`,
    );

    console.log("Cleanup done:", {
      rateLimits: limits.rowCount,
      adminSessions: sessions.rowCount,
      carts: carts.rowCount,
      unconfirmedSubscribers: pending.rowCount,
    });
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
