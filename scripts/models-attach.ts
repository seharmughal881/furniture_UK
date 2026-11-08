/**
 * Attaches a 3D model file (.glb) you already have to a product, so the room planner
 * shows that exact piece instead of a procedural stand-in.
 *
 *   npm run models:attach -- <product-slug> <path/to/model.glb>            # this machine
 *   npm run models:attach -- <product-slug> <path/to/model.glb> --blob     # for production
 *   npm run models:attach -- <product-slug> <path/to/model.glb> --force    # replace an existing one
 *
 * Why two modes. The generator (models:generate) writes into data/models/, which is in
 * .gitignore, and a Vercel function's filesystem is rebuilt on every deploy -- so a file
 * put there is invisible in production and /api/models/<slug>/file answers 404. --blob
 * uploads to Vercel Blob instead and stores the https address in product_models.file_name;
 * getModelState hands that straight to the browser. Local is right for trying a model out,
 * --blob for the live site.
 *
 * Nothing here calls fal.ai, so nothing is billed: this only registers a file you supply.
 */
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { Pool } from "pg";
import { describe, optimiseGlb } from "./glb-optimise";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [slug, filePath] = argv.filter((a) => !a.startsWith("--"));
const useBlob = flags.has("--blob");
const force = flags.has("--force");
// Generated models routinely arrive at 10-20 MB for one piece of furniture, which no
// planner can hold several of. --raw is the escape hatch for a model that is already
// optimised, or when you need to see the original for comparison.
const raw = flags.has("--raw");

if (!slug || !filePath) {
  console.error(
    "Usage: npm run models:attach -- <product-slug> <path/to/model.glb> [--blob] [--force]\n" +
      "   e.g. npm run models:attach -- atlanta-bedroom-set ~/Downloads/sofa.glb",
  );
  process.exit(1);
}

const MODELS_DIR = join(__dirname, "..", "data", "models");
// Same shape the file route will accept back: /^[a-z0-9-]+$/ with ".glb" appended.
const SAFE_NAME = /^[a-z0-9-]+$/;

/** Say which database is being written to, host only, never the password. */
const target = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();

/** Reads the 12-byte glTF header, so a renamed .zip or a half-finished download is caught here. */
async function readGlbHeader(path: string) {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    if (bytesRead < 12) return null;
    return { magic: buf.toString("ascii", 0, 4), version: buf.readUInt32LE(4), declared: buf.readUInt32LE(8) };
  } finally {
    await fh.close();
  }
}

async function main() {
  console.log(`\nTarget database: ${target}`);

  const source = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  if (!existsSync(source)) {
    console.error(`No file at ${source}`);
    process.exit(1);
  }
  if (!source.toLowerCase().endsWith(".glb")) {
    console.error(`${basename(source)} is not a .glb. Export the model as binary glTF (.glb) and try again.`);
    process.exit(1);
  }

  const header = await readGlbHeader(source);
  if (!header || header.magic !== "glTF") {
    console.error(`${basename(source)} is not a glTF binary file (its header does not start with "glTF").`);
    process.exit(1);
  }
  const { size } = await stat(source);
  if (header.declared !== size) {
    console.error(
      `${basename(source)} looks truncated: the header declares ${header.declared.toLocaleString()} bytes but the ` +
        `file is ${size.toLocaleString()}. Download it again.`,
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, kind, active, images[1] AS image FROM products WHERE slug = $1`,
      [slug],
    );
    const product = rows[0];
    if (!product) {
      console.error(`No product has the web address "${slug}".`);
      process.exit(1);
    }

    const existing = await pool.query(
      `SELECT status, file_name FROM product_models WHERE product_id = $1`,
      [product.id],
    );
    if (existing.rows[0]?.status === "ready" && !force) {
      console.error(
        `\n${product.name} already has a 3D model (${existing.rows[0].file_name}).\n` +
          `Pass --force to replace it.`,
      );
      process.exit(1);
    }

    const original = await readFile(source);
    let payload: Uint8Array = original;
    if (raw) {
      console.log(`\nOptimisation skipped (--raw): ${(size / 1024 / 1024).toFixed(1)} MB`);
    } else {
      const result = await optimiseGlb(original);
      payload = result.data;
      console.log(`\nOptimised: ${describe(result)}`);
    }

    // A bare name for a local file, a full https address for one on Vercel Blob.
    let fileName: string;
    if (useBlob) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error(
          "\nBLOB_READ_WRITE_TOKEN is not set, so there is nowhere to upload to.\n" +
            "Create a store at Vercel -> Storage -> Blob, then copy the token into .env.local\n" +
            "(or run `vercel env pull .env.local`). Without --blob the model is stored locally instead.",
        );
        process.exit(1);
      }
      // Imported here, not at the top: the local path must not need the Blob SDK at all.
      const { put } = await import("@vercel/blob");
      console.log(`\nUploading ${(payload.byteLength / 1024 / 1024).toFixed(1)} MB to Vercel Blob…`);
      // @vercel/blob takes a Buffer, not a bare Uint8Array; this wraps, it does not copy.
      const blob = await put(`models/${product.slug}.glb`, Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength), {
        access: "public",
        contentType: "model/gltf-binary",
        // A replaced model must get a new address, or browsers and the CDN keep serving
        // the old one from cache.
        addRandomSuffix: true,
      });
      fileName = blob.url;
      console.log(`Uploaded: ${blob.url}`);
    } else {
      const stamped = `${product.slug}-${Date.now().toString(36)}`;
      if (!SAFE_NAME.test(stamped)) {
        console.error(`"${stamped}" is not a name the model file route will serve. Rename the product's web address.`);
        process.exit(1);
      }
      await mkdir(MODELS_DIR, { recursive: true });
      await writeFile(join(MODELS_DIR, `${stamped}.glb`), payload);
      fileName = stamped;
      console.log(`Stored at data/models/${stamped}.glb (${(payload.byteLength / 1024 / 1024).toFixed(1)} MB)`);
    }

    // The row is about to stop pointing at the previous local file, and nothing else ever
    // deletes it -- so without this each --force leaves a dead multi-megabyte GLB behind.
    const previous = existing.rows[0]?.file_name;
    if (previous && !previous.startsWith("https://") && previous !== fileName) {
      await rm(join(MODELS_DIR, `${previous}.glb`), { force: true });
      console.log(`Removed the previous file data/models/${previous}.glb`);
    }

    await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image, file_name)
       VALUES ($1, 'ready', 'manual', $2, $3, $4)
       ON CONFLICT (product_id) DO UPDATE SET
         status = 'ready', provider = 'manual', model_id = EXCLUDED.model_id,
         source_image = EXCLUDED.source_image, file_name = EXCLUDED.file_name,
         status_url = NULL, response_url = NULL, error = NULL, updated_at = now()`,
      [product.id, basename(source), product.image ?? "", fileName],
    );

    console.log(`\nAttached to: ${product.name}`);
    console.log(`  /product/${product.slug}`);
    console.log(`  served as: ${fileName.startsWith("https://") ? fileName : `/api/models/${product.slug}/file`}`);

    if (!product.active) {
      console.log("\nNote: this product is archived, so it does not appear on the site.");
    }
    if (!product.kind) {
      console.log(
        "\nNote: this product has no 3D model shape, and the planner only lists products that have one\n" +
          "(see app/(site)/planner/page.tsx). Set a shape in the admin under 'Where it appears' to place it.",
      );
    }
    console.log("\nOpen /planner and choose \"✨ AI 3D (real shape)\" to see it.\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
