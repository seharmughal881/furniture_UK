// Imports 3D models made in the free Colab notebook (a zip or folder of <slug>.glb files).
//   npm run models:import -- ~/Downloads/muscat-3d-models.zip            # this machine
//   npm run models:import -- ~/Downloads/muscat-3d-models.zip --blob     # for production
//   npm run models:import -- ~/Downloads/muscat-3d-models.zip --raw      # skip optimisation
//
// Every model is optimised on the way in (see scripts/glb-optimise.ts): generated meshes
// are far too heavy to put several of in one planner scene. --blob uploads to Vercel Blob
// instead of data/models/, which is the only form that survives a deploy, because
// data/models/ is gitignored and a Vercel function's filesystem is rebuilt each time.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { put } from "@vercel/blob";
import { Pool } from "pg";
import { describe, optimiseGlb } from "./glb-optimise";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const MODELS_DIR = join(__dirname, "..", "data", "models");

const useBlob = process.argv.includes("--blob");
const raw = process.argv.includes("--raw");

/** Say which database is being written to, host only, never the password. */
const target = () => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
};

/**
 * The tool that made the file, from the glTF asset.generator field.
 *
 * This used to be hard-coded to TripoSR, which was true only while the Colab notebook was
 * the only source. Models now also arrive from FurniMesh, Meshy and others, and recording
 * the wrong maker against them makes it impossible to tell later which products need
 * regenerating when one tool turns out to be better than another.
 */
function generatorOf(bytes: Buffer): string {
  try {
    const jsonLength = bytes.readUInt32LE(12);
    const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")).asset ?? {};
    return String(asset.extras?.generatedBy ?? asset.generator ?? "unknown").slice(0, 120);
  } catch {
    return "unknown";
  }
}

function findGlbs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? findGlbs(p) : f.toLowerCase().endsWith(".glb") ? [p] : [];
  });
}

async function main() {
  const src = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!src || !existsSync(src)) throw new Error("Usage: npm run models:import -- <zip file or folder> [--blob] [--raw]");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (useBlob && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set, so there is nowhere to upload to.\n" +
        "Create a store at Vercel -> Storage -> Blob, then put the token in .env.local.",
    );
  }
  console.log(`\nTarget database: ${target()}`);
  let dir = src;
  if (statSync(src).isFile()) {
    dir = mkdtempSync(join(tmpdir(), "mf-models-"));
    execFileSync("unzip", ["-o", "-q", src, "-d", dir]);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(MODELS_DIR, { recursive: true });
  let ok = 0;
  let savedBytes = 0;
  for (const file of findGlbs(dir)) {
    const slug = basename(file, ".glb");
    const head = readFileSync(file).subarray(0, 4).toString("latin1");
    if (head !== "glTF") {
      console.log(`skip ${slug}: not a GLB file`);
      continue;
    }
    const { rows } = await pool.query(
      `SELECT p.id, p.images[1] AS image, m.file_name AS previous
         FROM products p LEFT JOIN product_models m ON m.product_id = p.id
        WHERE p.slug = $1 AND p.active`,
      [slug],
    );
    if (!rows[0]) {
      console.log(`skip ${slug}: no such product`);
      continue;
    }
    const original = readFileSync(file);
    let payload: Uint8Array = original;
    if (!raw) {
      const result = await optimiseGlb(original);
      payload = result.data;
      console.log(`${slug}: ${describe(result)}`);
    }
    savedBytes += original.byteLength - payload.byteLength;

    let fileName: string;
    if (useBlob) {
      const blob = await put(`models/${slug}.glb`, Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength), {
        access: "public",
        contentType: "model/gltf-binary",
        // A replaced model must get a new address, or browsers and the CDN keep serving
        // the old one from cache.
        addRandomSuffix: true,
      });
      fileName = blob.url;
    } else {
      fileName = `${slug}-${Date.now().toString(36)}`;
      writeFileSync(join(MODELS_DIR, `${fileName}.glb`), payload);
    }

    // The row is about to stop pointing at the previous local file, and nothing else ever
    // deletes it -- so without this every re-import leaves a dead GLB on disk.
    const previous = rows[0].previous as string | null;
    if (previous && !previous.startsWith("https://") && previous !== fileName) {
      rmSync(join(MODELS_DIR, `${previous}.glb`), { force: true });
    }

    const generator = generatorOf(original);
    await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image, file_name)
       VALUES ($1, 'ready', 'import', $4, $2, $3)
       ON CONFLICT (product_id) DO UPDATE SET status = 'ready', provider = 'import', model_id = $4,
         file_name = $3, error = NULL, updated_at = now()`,
      [rows[0].id, rows[0].image ?? "", fileName, generator],
    );
    ok++;
  }
  console.log(
    `\nImported ${ok} 3D models ${useBlob ? "to Vercel Blob" : `into ${MODELS_DIR}`}` +
      (savedBytes > 0 ? `, saving ${(savedBytes / 1024 / 1024).toFixed(0)} MB` : ""),
  );
  if (!useBlob) console.log("These are on this machine only. Re-run with --blob for the live site.");
  await pool.end();
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
