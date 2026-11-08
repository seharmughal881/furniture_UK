/**
 * Turns product photos into real 3D models with SAM 3D Objects on fal.ai.
 *
 *   npm run models:fal -- dublin atlanta-bedroom-set     # named products
 *   npm run models:fal -- --all                          # every placeable product without one
 *   npm run models:fal -- dublin --prompt "armchair"     # override what to cut out
 *   npm run models:fal -- --all --blob                   # store on Vercel Blob, for production
 *   npm run models:fal -- dublin --force                 # replace an existing model
 *
 * Why this model. The four things a planner model has to be -- a closed volume, a modelled
 * back, sane proportions and a real PBR texture -- are not all met by the free routes.
 * Measured on this project's own files: Meta's SAM 3D produced a watertight mesh but
 * vertex colours and no UVs, so no texture could be applied; FurniMesh produced UVs and
 * two textures but an open shell with 78,684 boundary edges. SAM 3D with
 * `export_textured_glb` gives both, which is why it is the one wired up here.
 *
 * Cost. fal charges per run ($0.02 at the time of writing), so this never starts work on
 * more than CONFIRM_ABOVE products without --yes, and it prints the bill it is about to
 * run up first. Nothing else in the project calls this endpoint.
 *
 * FAL_KEY must be in .env.local. Keep it out of Vercel unless you mean to: with a key set,
 * the public /api/models/[slug] route will also start generating models for visitors.
 */
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { describe, optimiseGlb } from "./glb-optimise";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const MODELS_DIR = join(__dirname, "..", "data", "models");
const ENDPOINT = process.env.FAL_3D_MODEL_SAM ?? "fal-ai/sam-3/3d-objects";
const QUEUE = process.env.FAL_QUEUE_BASE ?? "https://queue.fal.run";
/** Published price per run; only used to show what a batch will cost before it starts. */
const PRICE_USD = 0.02;
/** More than this many products needs --yes, so a stray --all cannot quietly spend money. */
const CONFIRM_ABOVE = 5;
const POLL_MS = 4000;
const TIMEOUT_MS = 10 * 60 * 1000;

/**
 * What to tell SAM 3 to cut out of the photo, per furniture type.
 *
 * This is a *segmentation* prompt -- a plain noun naming the object -- not a style
 * instruction. The model has nowhere to put "realistic upholstery" or "no UV seams";
 * those belong to services that take text guidance alongside the image.
 */
const PROMPT: Record<string, string> = {
  sofa: "sofa", sectional: "sofa", armchair: "armchair", pouf: "ottoman", bench: "bench",
  coffeeTable: "coffee table", sideTable: "side table", consoleTable: "console table",
  diningTable: "dining table", desk: "desk", diningChair: "chair", officeChair: "office chair",
  barStool: "bar stool", bed: "bed", nightstand: "bedside table", dresser: "chest of drawers",
  wardrobe: "wardrobe", sideboard: "sideboard", bookshelf: "bookshelf", mediaConsole: "tv stand",
  mirror: "mirror", rug: "rug", floorLamp: "floor lamp", tableLamp: "table lamp",
};

const argv = process.argv.slice(2);
/** Flags that consume the next argument, so it is not mistaken for a product slug. */
const TAKES_VALUE = ["--prompt", "--limit"];
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const slugs = argv.filter((a, i) => !a.startsWith("--") && !TAKES_VALUE.includes(argv[i - 1] ?? ""));

const all = flag("all");
const force = flag("force");
const useBlob = flag("blob");
const yes = flag("yes");
const raw = flag("raw");
const promptOverride = value("prompt");
const limit = Number(value("limit") ?? 0) || 0;

/** Say which database is being written to, host only, never the key or password. */
const target = () => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
};

const auth = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" });

/**
 * Only fal's own hosts, and only over https.
 *
 * The status and result addresses come back in fal's response and are then fetched *with
 * the API key attached*, so an unchecked value would be a way to post the key elsewhere.
 * Same rule as src/lib/models3d-core.ts.
 */
const KEY_HOSTS = ["queue.fal.run", "fal.run", "rest.alpha.fal.ai"];
const FILE_SUFFIXES = [".fal.media", ".fal.run", ".fal.ai"];
function allowed(raw: string | null | undefined, exact: string[], suffixes: string[] = []): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  return exact.includes(u.host) || suffixes.some((s) => u.host.endsWith(s)) ? u.toString() : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Job = { slug: string; name: string; kind: string; image: string };

/** Runs one product through the queue and returns the GLB bytes. */
async function generate(job: Job): Promise<Uint8Array> {
  const prompt = promptOverride ?? PROMPT[job.kind] ?? "furniture";
  const submitted = await fetch(`${QUEUE}/${ENDPOINT}`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({
      image_url: job.image,
      prompt,
      // Without this SAM 3D returns vertex colours and no UV map, which cannot carry a
      // texture at all -- the single thing its output was missing.
      export_textured_glb: true,
    }),
  }).catch(() => null);

  if (!submitted?.ok) {
    throw new Error(`fal refused the job${submitted ? ` (HTTP ${submitted.status}: ${await submitted.text()})` : ""}`);
  }
  const queued = await submitted.json();
  const statusUrl = allowed(queued.status_url, KEY_HOSTS);
  const responseUrl = allowed(queued.response_url, KEY_HOSTS);
  if (!statusUrl || !responseUrl) throw new Error("fal returned a job address that is not a recognised fal.ai host");

  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out waiting for fal");
    await sleep(POLL_MS);
    const st = await fetch(statusUrl, { headers: auth() }).then((r) => r.json()).catch(() => null);
    if (!st) continue;
    if (st.status === "COMPLETED") break;
    if (st.error) throw new Error(String(st.error));
  }

  const result = await fetch(responseUrl, { headers: auth() }).then((r) => r.json()).catch(() => null);
  // individual_glbs is populated only for multi-object scenes; model_glb is the single
  // mesh, or the combined one. Prefer the first individual piece: a product photo that
  // happens to show a whole set should still give us just the piece we asked for.
  const url =
    allowed(result?.individual_glbs?.[0]?.url, KEY_HOSTS, FILE_SUFFIXES) ??
    allowed(result?.model_glb?.url, KEY_HOSTS, FILE_SUFFIXES);
  if (!url) throw new Error("no usable GLB in fal's response");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download the GLB (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 4)).toString("latin1") !== "glTF") throw new Error("fal returned something that is not a GLB");
  return bytes;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!process.env.FAL_KEY) {
    throw new Error(
      "FAL_KEY is not set.\n" +
        "Create a key at https://fal.ai/dashboard/keys and put it in .env.local as FAL_KEY=...\n" +
        "Do not paste it into a chat or commit it.",
    );
  }
  if (useBlob && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set, so there is nowhere to upload to. Vercel -> Storage -> Blob.");
  }

  console.log(`\nTarget database: ${target()}`);
  console.log(`Model:           ${ENDPOINT}  (textured GLB)`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<Job & { id: number; has_model: boolean }>(
      `SELECT p.id, p.slug, p.name, p.kind, p.images[1] AS image,
              (m.product_id IS NOT NULL AND m.status = 'ready') AS has_model
         FROM products p LEFT JOIN product_models m ON m.product_id = p.id
        WHERE p.active AND p.kind IS NOT NULL AND p.kind <> '' AND p.images[1] IS NOT NULL
          ${all ? "" : "AND p.slug = ANY($1)"}
        ORDER BY p.featured DESC, p.sort_order, p.id`,
      all ? [] : [slugs],
    );

    if (!all && slugs.length === 0) {
      console.error("\nName the products to generate, or pass --all.");
      process.exit(1);
    }
    const missing = all ? [] : slugs.filter((s) => !rows.some((r) => r.slug === s));
    for (const s of missing) console.log(`  skip ${s}: no such product, or it has no 3D shape / photo`);

    let todo = rows.filter((r) => force || !r.has_model);
    const already = rows.length - todo.length;
    if (limit) todo = todo.slice(0, limit);

    if (already) console.log(`\n${already} already have a model (pass --force to replace).`);
    if (todo.length === 0) {
      console.log("Nothing to do.\n");
      return;
    }

    console.log(`\n${todo.length} product(s) to generate — about $${(todo.length * PRICE_USD).toFixed(2)} at $${PRICE_USD}/model.`);
    if (todo.length > CONFIRM_ABOVE && !yes) {
      console.log(`\nThat is more than ${CONFIRM_ABOVE}. Re-run with --yes to go ahead, or --limit <n> to try a few first.\n`);
      return;
    }

    let ok = 0;
    for (const [i, job] of todo.entries()) {
      const label = `[${i + 1}/${todo.length}] ${job.slug}`;
      try {
        process.stdout.write(`${label} … `);
        const bytes = await generate(job);
        // Optimise once: it is the expensive step, and calling it twice to build the log
        // line would double the work for every product in the batch.
        const optimised = raw ? null : await optimiseGlb(bytes);
        const payload = optimised?.data ?? bytes;
        const note = optimised ? describe(optimised) : `${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB (raw)`;

        let fileName: string;
        if (useBlob) {
          const { put } = await import("@vercel/blob");
          const blob = await put(`models/${job.slug}.glb`, Buffer.from(payload), {
            access: "public",
            contentType: "model/gltf-binary",
            addRandomSuffix: true,
          });
          fileName = blob.url;
        } else {
          await mkdir(MODELS_DIR, { recursive: true });
          fileName = `${job.slug}-${Date.now().toString(36)}`;
          await writeFile(join(MODELS_DIR, `${fileName}.glb`), payload);
        }

        const { rows: prev } = await pool.query(`SELECT file_name FROM product_models WHERE product_id = $1`, [job.id]);
        await pool.query(
          `INSERT INTO product_models (product_id, status, provider, model_id, source_image, file_name)
           VALUES ($1, 'ready', 'fal', $2, $3, $4)
           ON CONFLICT (product_id) DO UPDATE SET
             status = 'ready', provider = 'fal', model_id = $2, source_image = $3,
             file_name = $4, status_url = NULL, response_url = NULL, error = NULL, updated_at = now()`,
          [job.id, ENDPOINT, job.image, fileName],
        );
        // Nothing else deletes the file the row used to point at.
        const old = prev[0]?.file_name as string | undefined;
        if (old && !old.startsWith("https://") && old !== fileName) {
          await rm(join(MODELS_DIR, `${old}.glb`), { force: true });
        }

        console.log(note);
        ok++;
      } catch (err) {
        console.log(`FAILED — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`\n${ok} of ${todo.length} generated${useBlob ? " and uploaded to Vercel Blob" : ` into ${MODELS_DIR}`}.`);
    if (!useBlob && ok) console.log("These are on this machine only. Re-run with --blob for the live site.\n");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
