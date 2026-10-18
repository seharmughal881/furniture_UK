// Creates tables and upserts the catalogue. Run: npm run db:setup
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { SEED_EXTRAS, SEED_MATERIALS, SEED_PRODUCTS, SEED_REVIEWS } from "../src/lib/catalog-data";

// Settings come from ENV_FILE (e.g. a file made by `vercel env pull`) or .env.local.
// Variables already set in the shell always win, so `DATABASE_URL=... npm run db:setup` also works.
const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));

    for (const [i, p] of SEED_PRODUCTS.entries()) {
      await client.query(
        `INSERT INTO products (slug, name, kind, tagline, description, price_cents, lead_time_weeks,
                               width_cm, depth_cm, height_cm, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name, kind = EXCLUDED.kind, tagline = EXCLUDED.tagline,
           description = EXCLUDED.description, price_cents = EXCLUDED.price_cents,
           lead_time_weeks = EXCLUDED.lead_time_weeks, width_cm = EXCLUDED.width_cm,
           depth_cm = EXCLUDED.depth_cm, height_cm = EXCLUDED.height_cm, sort_order = EXCLUDED.sort_order`,
        [p.slug, p.name, p.kind, p.tagline, p.description, p.price_cents, p.lead_time_weeks,
         p.width_cm, p.depth_cm, p.height_cm, i],
      );
    }

    for (const [i, m] of SEED_MATERIALS.entries()) {
      await client.query(
        `INSERT INTO materials (slug, name, role, hex, note, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name, role = EXCLUDED.role, hex = EXCLUDED.hex,
           note = EXCLUDED.note, sort_order = EXCLUDED.sort_order`,
        [m.slug, m.name, m.role, m.hex, m.note, i],
      );
    }

    for (const [slug, x] of Object.entries(SEED_EXTRAS)) {
      await client.query(`UPDATE products SET category = $2, details = $3, care = $4, rooms = $5 WHERE slug = $1`, [
        slug, x.category, x.details, x.care, x.rooms,
      ]);
    }

    // Sample reviews are re-seeded each run; real customer reviews (is_demo = false) are never touched.
    await client.query("DELETE FROM reviews WHERE is_demo");
    for (const r of SEED_REVIEWS) {
      await client.query(
        `INSERT INTO reviews (product_id, author, rating, title, body, is_demo)
         SELECT id, $2, $3, $4, $5, true FROM products WHERE slug = $1`,
        [r.slug, r.author, r.rating, r.title, r.body],
      );
    }

    await client.query("COMMIT");
    const { rows } = await client.query(
      "SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM materials) AS materials",
    );
    console.log("Database ready:", rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
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
