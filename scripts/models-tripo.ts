/**
 * Turns a product photo into a 3D model with Tripo, and attaches it to the product.
 *
 *   npm run models:tripo -- dublin                            # use the product's own photo
 *   npm run models:tripo -- dublin --image ~/Desktop/sofa.jpg # use a photo you supply
 *   npm run models:tripo -- dublin --blob                     # store on Vercel Blob, for production
 *   npm run models:tripo -- dublin --force                    # replace an existing model
 *   npm run models:tripo -- dublin --raw                      # skip GLB optimisation
 *
 * One product per run, on purpose. There is deliberately no --all here: Tripo bills against
 * a finite credit balance, and the standing rule on this project is that a model is only
 * generated for a product the owner has named. models-fal.ts has --all because fal bills
 * $0.02 a run; this one does not.
 *
 * Credits. A v3.1 image-to-model run is about 15 credits, and texture work adds to that, so
 * the free plan's 200/month is roughly a dozen models. The figure printed before a run is an
 * estimate from Tripo's published table, not a quote -- the dashboard is the real number.
 *
 * Licensing, which matters more than the cost. Models generated on Tripo's FREE plan are
 * CC BY 4.0, non-commercial, and are public on their site. That is fine for testing and not
 * fine for a client deliverable or the live storefront. A paid plan attaches commercial
 * rights. This script cannot tell which plan a key belongs to, so it says so and continues.
 *
 * TRIPO_API_KEY must be in .env.local. Unlike FAL_KEY there is no public route that reads
 * it, so it is only ever spent by someone running this script deliberately.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Pool } from "pg";
import { describe, optimiseGlb } from "./glb-optimise";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const MODELS_DIR = join(__dirname, "..", "data", "models");
const API = process.env.TRIPO_API_BASE ?? "https://openapi.tripo3d.ai/v3";
/** v3.1 is the current image-to-model version; older ones stay selectable for comparison. */
const MODEL = process.env.TRIPO_3D_MODEL ?? "v3.1-20260211";
/** Published cost of one v3.1 image-to-model run, before texture extras. Display only. */
const CREDITS_PER_RUN = 15;
const POLL_MS = 4000;
const TIMEOUT_MS = 10 * 60 * 1000;
/** Tripo accepts PNG, JPEG and WebP, up to 20 MB, and wants at least 256x256. */
const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const argv = process.argv.slice(2);
const TAKES_VALUE = ["--image", "--model"];
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const slugs = argv.filter((a, i) => !a.startsWith("--") && !TAKES_VALUE.includes(argv[i - 1] ?? ""));

const force = flag("force");
const useBlob = flag("blob");
const raw = flag("raw");
const imageArg = value("image");
const modelArg = value("model");

/** Say which database is being written to, host only, never the password. */
const target = () => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
};

const authJson = () => ({
  Authorization: `Bearer ${process.env.TRIPO_API_KEY}`,
  "Content-Type": "application/json",
});

/**
 * Only Tripo's own hosts, and only over https.
 *
 * model_url arrives inside Tripo's reply, so an unchecked value is somewhere else's address
 * that this script would then fetch. The download itself deliberately carries no auth header
 * (see below), which removes the worst case, but the check stays: same rule as models-fal.ts
 * and src/lib/models3d-core.ts. If Tripo ever moves its CDN this will refuse loudly and name
 * the host, which is the right failure -- better than quietly fetching from anywhere.
 */
const FILE_SUFFIXES = [".tripo3d.ai", ".tripo3d.com", ".tripo-data.com"];
function allowed(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  return FILE_SUFFIXES.some((s) => u.host === s.slice(1) || u.host.endsWith(s)) ? u.toString() : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Unwraps Tripo's {code, data} envelope, where code 0 means success. */
async function tripo<T>(res: Response | null, what: string): Promise<T> {
  if (!res) throw new Error(`could not reach Tripo while trying to ${what}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`Tripo refused to ${what} (HTTP ${res.status}: ${body.slice(0, 300)})`);
  let parsed: { code?: number; data?: T; message?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Tripo returned something that is not JSON while trying to ${what}`);
  }
  if (parsed.code !== 0 || !parsed.data) {
    throw new Error(`Tripo rejected the request to ${what}: ${parsed.message ?? `code ${parsed.code}`}`);
  }
  return parsed.data;
}

/**
 * Hands Tripo the image and returns whatever `input` should be.
 *
 * A public URL goes straight through -- the product photos here are Shopify CDN addresses,
 * which Tripo can fetch itself, so the upload round-trip is skipped. A local file has to be
 * uploaded first and becomes a file token.
 */
async function resolveInput(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) return source;

  if (!existsSync(source)) throw new Error(`no such image file: ${source}`);
  const ext = (source.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const type = IMAGE_TYPES[ext];
  if (!type) throw new Error(`Tripo takes PNG, JPEG or WebP; this is "${ext || "extension-less"}"`);

  const bytes = await readFile(source);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`that image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB; Tripo's limit is 20 MB`);
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type }), basename(source));
  // No Content-Type here: fetch sets the multipart boundary itself, and overriding it breaks the upload.
  const res = await fetch(`${API}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` },
    body: form,
  }).catch(() => null);

  const data = await tripo<{ file_token: string }>(res, "upload the image");
  if (!data.file_token) throw new Error("Tripo accepted the upload but returned no file token");
  return data.file_token;
}

/** Runs one image through Tripo and returns the GLB bytes. */
async function generate(source: string): Promise<Uint8Array> {
  const input = await resolveInput(source);

  const created = await fetch(`${API}/generation/image-to-model`, {
    method: "POST",
    headers: authJson(),
    body: JSON.stringify({
      input,
      model: modelArg ?? MODEL,
      texture: true,
      pbr: true,
      texture_quality: "detailed",
      // `quad: true` would switch the output to FBX, which the planner cannot load. Left off.
    }),
  }).catch(() => null);

  const { task_id: taskId } = await tripo<{ task_id: string }>(created, "start the job");
  if (!taskId) throw new Error("Tripo started no job and returned no task id");
  process.stdout.write(`task ${taskId.slice(0, 8)}… `);

  const deadline = Date.now() + TIMEOUT_MS;
  let url: string | null = null;
  let lastProgress = -1;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`timed out after 10 min — the job may still finish; task ${taskId}`);
    await sleep(POLL_MS);

    const res = await fetch(`${API}/tasks/${taskId}`, { headers: authJson() }).catch(() => null);
    if (!res) continue; // a dropped poll is not a failed job
    const data = await tripo<{
      status: string;
      progress?: number;
      output?: { model_url?: string };
      error_message?: string;
    }>(res, "check the job").catch(() => null);
    if (!data) continue;

    if (typeof data.progress === "number" && data.progress !== lastProgress) {
      lastProgress = data.progress;
      process.stdout.write(`${data.progress}% `);
    }

    if (data.status === "success") {
      url = allowed(data.output?.model_url);
      if (!url) {
        const host = (() => {
          try {
            return new URL(data.output?.model_url ?? "").host;
          } catch {
            return "(none)";
          }
        })();
        throw new Error(`Tripo finished but the model address is not a recognised Tripo host: ${host}`);
      }
      break;
    }
    if (data.status === "failed" || data.status === "cancelled" || data.status === "banned" || data.status === "expired") {
      throw new Error(`Tripo reported the job ${data.status}${data.error_message ? `: ${data.error_message}` : ""}`);
    }
    // queued / running / anything unrecognised: keep waiting until the deadline.
  }

  // No Authorization header on purpose: this is a CDN address, and the key has no business
  // travelling to it.
  const file = await fetch(url);
  if (!file.ok) throw new Error(`could not download the GLB (HTTP ${file.status})`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 4)).toString("latin1") !== "glTF") {
    throw new Error("Tripo returned a file that is not a GLB (check that --model is an image-to-model version)");
  }
  return bytes;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!process.env.TRIPO_API_KEY) {
    throw new Error(
      "TRIPO_API_KEY is not set.\n" +
        "Create a key at https://platform.tripo3d.ai and put it in .env.local as TRIPO_API_KEY=...\n" +
        "Do not paste it into a chat or commit it.",
    );
  }
  if (useBlob && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set, so there is nowhere to upload to. Vercel -> Storage -> Blob.");
  }
  if (slugs.length === 0) {
    throw new Error("Name one product, e.g. `npm run models:tripo -- dublin`.");
  }
  if (slugs.length > 1) {
    throw new Error(`One product at a time. You named ${slugs.length}: ${slugs.join(", ")}`);
  }
  const slug = slugs[0];

  console.log(`\nTarget database: ${target()}`);
  console.log(`Model:           ${modelArg ?? MODEL} (Tripo image-to-model, textured GLB)`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{ id: number; slug: string; name: string; image: string | null; has_model: boolean }>(
      `SELECT p.id, p.slug, p.name, p.images[1] AS image,
              (m.product_id IS NOT NULL AND m.status = 'ready') AS has_model
         FROM products p LEFT JOIN product_models m ON m.product_id = p.id
        WHERE p.slug = $1`,
      [slug],
    );
    const product = rows[0];
    if (!product) throw new Error(`no product with the slug "${slug}".`);
    if (product.has_model && !force) {
      console.log(`\n${slug} already has a model. Pass --force to replace it.\n`);
      return;
    }

    const source = imageArg ?? product.image;
    if (!source) throw new Error(`${slug} has no photo, so pass one with --image <file>.`);

    console.log(`Product:         ${product.name}`);
    console.log(`Source image:    ${imageArg ? source : `${source.slice(0, 70)}${source.length > 70 ? "…" : ""}`}`);
    console.log(`Cost:            about ${CREDITS_PER_RUN} credits, plus texture extras.`);
    console.log(
      "Licence:         if this key is on Tripo's FREE plan the model is CC BY 4.0, non-commercial\n" +
        "                 and public on Tripo. Fine for testing, not for the client build.\n",
    );

    process.stdout.write(`${slug} … `);
    const bytes = await generate(source);
    const optimised = raw ? null : await optimiseGlb(bytes);
    const payload = optimised?.data ?? bytes;
    const note = optimised ? describe(optimised) : `${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB (raw)`;

    let fileName: string;
    if (useBlob) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`models/${slug}.glb`, Buffer.from(payload), {
        access: "public",
        contentType: "model/gltf-binary",
        addRandomSuffix: true,
      });
      fileName = blob.url;
    } else {
      await mkdir(MODELS_DIR, { recursive: true });
      fileName = `${slug}-${Date.now().toString(36)}`;
      await writeFile(join(MODELS_DIR, `${fileName}.glb`), payload);
    }

    const { rows: prev } = await pool.query(`SELECT file_name FROM product_models WHERE product_id = $1`, [product.id]);
    await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image, file_name)
       VALUES ($1, 'ready', 'tripo', $2, $3, $4)
       ON CONFLICT (product_id) DO UPDATE SET
         status = 'ready', provider = 'tripo', model_id = $2, source_image = $3,
         file_name = $4, status_url = NULL, response_url = NULL, error = NULL, updated_at = now()`,
      [product.id, modelArg ?? MODEL, source, fileName],
    );
    // Nothing else deletes the file the row used to point at.
    const old = prev[0]?.file_name as string | undefined;
    if (old && !old.startsWith("https://") && old !== fileName) {
      await rm(join(MODELS_DIR, `${old}.glb`), { force: true });
    }

    console.log(note);
    console.log(`\nDone — ${slug} now has a Tripo model${useBlob ? " on Vercel Blob" : ` in ${MODELS_DIR}`}.`);
    if (!useBlob) console.log("That is on this machine only. Re-run with --blob for the live site.\n");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
