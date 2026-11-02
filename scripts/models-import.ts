// Imports 3D models made in the free Colab notebook (a zip or folder of <slug>.glb files).
//   npm run models:import -- ~/Downloads/muscat-3d-models.zip
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Pool } from "pg";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const MODELS_DIR = join(__dirname, "..", "data", "models");

function findGlbs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? findGlbs(p) : f.toLowerCase().endsWith(".glb") ? [p] : [];
  });
}

async function main() {
  const src = process.argv[2];
  if (!src || !existsSync(src)) throw new Error("Usage: npm run models:import -- <zip file or folder>");
  let dir = src;
  if (statSync(src).isFile()) {
    dir = mkdtempSync(join(tmpdir(), "mf-models-"));
    execFileSync("unzip", ["-o", "-q", src, "-d", dir]);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(MODELS_DIR, { recursive: true });
  let ok = 0;
  for (const file of findGlbs(dir)) {
    const slug = basename(file, ".glb");
    const head = readFileSync(file).subarray(0, 4).toString("latin1");
    if (head !== "glTF") {
      console.log(`skip ${slug}: not a GLB file`);
      continue;
    }
    const { rows } = await pool.query(`SELECT id, images[1] AS image FROM products WHERE slug = $1 AND active`, [slug]);
    if (!rows[0]) {
      console.log(`skip ${slug}: no such product`);
      continue;
    }
    const name = `${slug}-${Date.now().toString(36)}`;
    copyFileSync(file, join(MODELS_DIR, `${name}.glb`));
    await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image, file_name)
       VALUES ($1, 'ready', 'colab', 'stabilityai/TripoSR', $2, $3)
       ON CONFLICT (product_id) DO UPDATE SET status = 'ready', provider = 'colab', model_id = 'stabilityai/TripoSR',
         file_name = $3, error = NULL, updated_at = now()`,
      [rows[0].id, rows[0].image ?? "", name],
    );
    ok++;
  }
  console.log(`Imported ${ok} 3D models into ${MODELS_DIR}`);
  await pool.end();
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
