// Pre-generates AI 3D models for furniture products so customers never wait.
//   npm run models:generate              # all furniture products without a model
//   npm run models:generate -- dublin    # just these slugs
//   npm run models:generate -- --retry   # also retry failed ones
import { existsSync } from "node:fs";
import { join } from "node:path";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const { Pool } = await import("pg");
  const { createModels3d } = await import("../src/lib/models3d-core");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { requestModel, getModelState } = createModels3d(pool);
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const retry = process.argv.includes("--retry");
  const { rows } = await pool.query(
    args.length
      ? `SELECT slug FROM products WHERE active AND kind IS NOT NULL AND slug = ANY($1) ORDER BY sort_order`
      : `SELECT slug FROM products WHERE active AND kind IS NOT NULL ORDER BY sort_order`,
    args.length ? [args] : [],
  );
  console.log(`${rows.length} products`);
  const pending = new Set<string>();
  for (const { slug } of rows) {
    const s = await requestModel(slug, { retry });
    console.log(slug.padEnd(50), s.status, "reason" in s ? s.reason : "");
    if (s.status === "queued") pending.add(slug);
    if (s.status === "unavailable" && /limit|configured/.test(s.reason)) break;
  }
  while (pending.size) {
    await new Promise((r) => setTimeout(r, 10_000));
    for (const slug of [...pending]) {
      const s = await getModelState(slug);
      if (s.status !== "queued") {
        console.log(slug.padEnd(50), "→", s.status, "error" in s ? s.error : "");
        pending.delete(slug);
      }
    }
    console.log(`waiting for ${pending.size}…`);
  }
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
