/**
 * Copies the videos in src/lib/product-videos.json into products.video_url.
 * Run: npm run videos:apply
 *
 * Why this is needed: product-videos.json is only read by category-videos.ts, which uses
 * it for the *category header* reels. The product page asks a different question --
 * ProductExperience.tsx line 321 does `const hasVideo = Boolean(product.videoUrl)`, and
 * that reads the products.video_url *column*. Nothing ever filled that column: the Shopify
 * import does not touch it, so every product had an empty string and the product page's
 * video tab could never appear for anyone.
 *
 * Idempotent, and it never clobbers a video set by hand in the admin: by default it only
 * fills rows that are still empty. Pass --force to overwrite them all.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import videos from "../src/lib/product-videos.json";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

const force = process.argv.includes("--force");
type Clip = { sd: string; hd: string; poster: string; seconds: number };

/**
 * Say which database is being written to, host only, never the password.
 *
 * Without this the output is ambiguous: "already had one: 52" looks identical whether it
 * ran against production or fell back to .env.local because DATABASE_URL was not exported.
 */
const target = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();

async function main() {
  console.log(`\nTarget database: ${target}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const entries = Object.entries(videos as Record<string, Clip>);
  let filled = 0;
  let skipped = 0;
  let unknown = 0;

  try {
    for (const [slug, clip] of entries) {
      // Prefer the HD rendition, fall back to SD when the store only has one.
      const url = clip.hd || clip.sd;
      if (!url) continue;
      const { rowCount } = await pool.query(
        `UPDATE products SET video_url = $2
          WHERE slug = $1 AND active ${force ? "" : "AND video_url = ''"}`,
        [slug, url],
      );
      if (rowCount) filled += rowCount;
      else {
        // Either no such product, or it already has a video and --force was not passed.
        const { rows } = await pool.query(`SELECT 1 FROM products WHERE slug = $1 AND active`, [slug]);
        rows.length ? skipped++ : unknown++;
      }
    }

    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE video_url <> '') AS "withVideo", count(*) AS total
         FROM products WHERE active`,
    );
    console.log(
      `\nVideos applied: ${filled}` +
        (skipped ? `, already had one: ${skipped}` : "") +
        (unknown ? `, no matching product: ${unknown}` : ""),
    );
    console.log(`Products with a video now: ${rows[0].withVideo} of ${rows[0].total}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
