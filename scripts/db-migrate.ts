/**
 * Applies db/schema.sql and NOTHING else. Run: npm run db:migrate
 *
 *   npm run db:migrate                          # uses .env.local
 *   DATABASE_URL="postgres://..." npm run db:migrate   # a specific database (e.g. Neon)
 *   ENV_FILE=.env.production npm run db:migrate
 *
 * Why this exists separately from db:setup: db-setup.ts also upserts the 24 SEED_PRODUCTS
 * from src/lib/catalog-data.ts and deletes demo reviews. That is right for a fresh
 * development database and wrong for a live one -- against the imported 632-product
 * Muscat catalogue it would add two dozen demo products to the shop. So bringing an
 * existing database up to the current schema had no safe command at all.
 *
 * schema.sql is written to be idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
 * EXISTS, DROP then ADD for constraints), so this is safe to re-run. It executes in one
 * transaction: either every migration lands or none does.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

// Host only -- never print the password that is in the connection string.
const target = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log(`Applying db/schema.sql to ${target} ...`);
    await client.query("BEGIN");
    await client.query(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
    await client.query("COMMIT");

    // Report what the catalogue now looks like, as a sanity check that the right database
    // was targeted and that nothing was seeded into it.
    const { rows } = await client.query(
      `SELECT (SELECT count(*) FROM products)                                  AS products,
              (SELECT count(*) FROM products WHERE active)                     AS active,
              (SELECT count(*) FROM stores)                                    AS stores,
              (SELECT count(*) FROM information_schema.columns
                WHERE table_name = 'products')                                 AS "productColumns"`,
    );
    console.log("Schema up to date:", rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
