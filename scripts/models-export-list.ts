// Writes the list of furniture products to turn into 3D (for the free Colab notebook).
//   npm run models:list              -> data/models-jobs.json (only products without a model yet)
//   npm run models:list -- --all     -> every furniture product
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const all = process.argv.includes("--all");
  const { rows } = await pool.query(
    `SELECT p.slug, p.name, p.kind, p.images[1] AS image
     FROM products p LEFT JOIN product_models m ON m.product_id = p.id AND m.status = 'ready'
     WHERE p.active AND p.kind IS NOT NULL AND p.images[1] IS NOT NULL ${all ? "" : "AND m.product_id IS NULL"}
     ORDER BY p.sort_order, p.id`,
  );
  const jobs = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    image: r.image.includes("cdn.shopify.com") ? `${r.image.split("?")[0]}?width=1024` : r.image,
  }));
  mkdirSync(join(__dirname, "..", "data"), { recursive: true });
  const out = join(__dirname, "..", "data", "models-jobs.json");
  writeFileSync(out, JSON.stringify(jobs, null, 1));
  console.log(`${jobs.length} products written to ${out}`);
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
