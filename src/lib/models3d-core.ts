import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

// Turns product photos into real 3D models (GLB) with an image-to-3D AI model on fal.ai.
// Each product is generated once; the GLB is downloaded and served from our own server.
// Queue API: https://fal.ai/docs/model-endpoints/queue

export const MODELS_DIR = join(process.cwd(), "data", "models");
const QUEUE = process.env.FAL_QUEUE_BASE ?? "https://queue.fal.run";
const MODEL = process.env.FAL_3D_MODEL ?? "fal-ai/hunyuan3d-v21";
const MAX_PER_DAY = Number(process.env.MAX_3D_PER_DAY ?? 50);

export type ModelState =
  | { status: "ready"; url: string }
  | { status: "queued" }
  | { status: "failed"; error: string }
  | { status: "none" }
  | { status: "unavailable"; reason: string };

/**
 * Hosts our fal.ai API key may be sent to, and hosts a generated model may be downloaded
 * from. The job and result URLs are read back out of the database and then fetched *with
 * the key attached*, so without this check a tampered row -- or a compromised upstream
 * response -- would send the key to an attacker's server. Defence in depth: today those
 * values only ever come from fal's own response.
 */
const KEY_HOSTS = ["queue.fal.run", "fal.run", "rest.alpha.fal.ai"];
const FILE_HOST_SUFFIXES = [".fal.media", ".fal.run", ".fal.ai"];

function allowedUrl(raw: string | null, exact: string[], suffixes: string[] = []): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const ok = exact.includes(url.host) || suffixes.some((s) => url.host.endsWith(s));
  return ok ? url.toString() : null;
}

export function createModels3d(pool: Pool) {
  const auth = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" });
  const aiEnabled = () => !!process.env.FAL_KEY;

  type Row = {
    product_id: number;
    status: "queued" | "ready" | "failed";
    status_url: string | null;
    response_url: string | null;
    file_name: string | null;
    error: string | null;
  };

  async function productBySlug(slug: string) {
    const { rows } = await pool.query(
      `SELECT id, slug, kind, images[1] AS image FROM products WHERE slug = $1 AND active`,
      [slug],
    );
    return rows[0] as { id: number; slug: string; kind: string | null; image: string | null } | undefined;
  }

  const fileUrl = (slug: string) => `/api/models/${encodeURIComponent(slug)}/file`;

  /**
   * Where a ready model actually lives.
   *
   * file_name holds one of two things. A bare name means data/models/<name>.glb on this
   * server, which is what pollJob writes. A full https:// address means the file is
   * hosted elsewhere -- Vercel Blob, via `npm run models:attach -- <slug> <file> --blob`.
   *
   * The remote form exists because data/models/ is in .gitignore and a Vercel function's
   * filesystem is rebuilt on every deploy, so a locally generated GLB is simply absent in
   * production and /api/models/<slug>/file answers 404 there. connect-src already allows
   * the Blob host (see next.config.ts), so GLTFLoader can fetch it directly.
   */
  const readyUrl = (slug: string, fileName: string | null) =>
    // An address, not a name: hand it to the browser as it stands. "https://" is a file on
    // Vercel Blob; a leading "/" is one served from public/, which is how a model added in
    // the admin works before Blob storage is configured. Routing either through
    // /api/models/[slug]/file would 404, because that route only serves data/models.
    fileName?.startsWith("https://") || fileName?.startsWith("/")
      ? fileName
      : // The stored file name goes in the query so the address changes whenever the model
        // does. The route answers at a fixed path and tells browsers to keep the file for a
        // day, so without this a replaced model kept serving the old bytes from cache and
        // looked like the attach had silently failed. The route ignores the query itself.
        `${fileUrl(slug)}?v=${encodeURIComponent(fileName ?? "")}`;

  /** Current state for a product, advancing a queued job if it has finished. */
  async function getModelState(slug: string): Promise<ModelState> {
    const p = await productBySlug(slug);
    if (!p) return { status: "unavailable", reason: "unknown product" };
    const { rows } = await pool.query<Row>(`SELECT * FROM product_models WHERE product_id = $1`, [p.id]);
    const row = rows[0];
    if (!row) return { status: "none" };
    if (row.status === "ready") return { status: "ready", url: readyUrl(p.slug, row.file_name) };
    if (row.status === "failed") return { status: "failed", error: row.error ?? "generation failed" };
    return pollJob(p.id, p.slug, row);
  }

  async function pollJob(productId: number, slug: string, row: Row): Promise<ModelState> {
    if (!aiEnabled() || !row.status_url || !row.response_url) return { status: "queued" };

    // Both URLs are validated before the API key is attached to a request for them.
    const statusUrl = allowedUrl(row.status_url, KEY_HOSTS);
    const responseUrl = allowedUrl(row.response_url, KEY_HOSTS);
    if (!statusUrl || !responseUrl) return fail(productId, "job URL is not a recognised fal.ai address");

    const st = await fetch(statusUrl, { headers: auth() }).then((r) => r.json()).catch(() => null);
    if (!st || st.status !== "COMPLETED") return { status: "queued" };
    if (st.error) return fail(productId, String(st.error));
    const result = await fetch(responseUrl, { headers: auth() }).then((r) => r.json()).catch(() => null);
    // Hunyuan 2.1 returns model_glb; the v2 family returns model_mesh
    const glbRaw: string | undefined = result?.model_glb?.url || result?.model_mesh?.url;
    if (!glbRaw) return fail(productId, "no 3D file in the AI response");
    // No key is sent here, but an unchecked URL would still be a request our server makes
    // to wherever the response said -- so the download host is allow-listed too.
    const glb = allowedUrl(glbRaw, KEY_HOSTS, FILE_HOST_SUFFIXES);
    if (!glb) return fail(productId, "3D file is not hosted at a recognised fal.ai address");
    const bin = await fetch(glb).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    if (!bin) return fail(productId, "could not download the 3D file");
    await mkdir(MODELS_DIR, { recursive: true });
    const name = `${slug}-${Date.now().toString(36)}`;
    await writeFile(join(MODELS_DIR, `${name}.glb`), Buffer.from(bin));
    await pool.query(
      `UPDATE product_models SET status = 'ready', file_name = $2, error = NULL, updated_at = now() WHERE product_id = $1`,
      [productId, name],
    );
    return { status: "ready", url: fileUrl(slug) };
  }

  async function fail(productId: number, error: string): Promise<ModelState> {
    await pool.query(`UPDATE product_models SET status = 'failed', error = $2, updated_at = now() WHERE product_id = $1`, [
      productId,
      error.slice(0, 500),
    ]);
    return { status: "failed", error };
  }

  /** Starts generation for a product (once). Safe to call repeatedly. */
  async function requestModel(slug: string, { retry = false } = {}): Promise<ModelState> {
    const p = await productBySlug(slug);
    if (!p) return { status: "unavailable", reason: "unknown product" };
    if (!p.kind || !p.image) return { status: "unavailable", reason: "not a furniture product" };
    const current = await getModelState(slug);
    if (current.status === "ready" || current.status === "queued") return current;
    if (current.status === "failed" && !retry) return current;
    if (!aiEnabled()) return { status: "unavailable", reason: "AI 3D is not configured (FAL_KEY)" };

    const image = p.image.includes("cdn.shopify.com") ? `${p.image.split("?")[0]}?width=1024` : p.image;

    /*
     * Claim the slot in the database BEFORE spending any money.
     *
     * The old order of operations was: check the daily cap, call fal (which bills us),
     * then write the row that stops a second attempt. Between the check and the write
     * there was no lock, so N simultaneous requests for one product all read "no model
     * yet", all passed the cap check, and all billed a generation -- the cap never saw
     * them. A burst of a few hundred unauthenticated POSTs could run up a large bill.
     *
     * One statement now does the cap check and the claim together. product_models has
     * product_id as its PRIMARY KEY, so exactly one of a set of concurrent inserts can
     * win; the losers fall into ON CONFLICT, whose WHERE is re-evaluated against the
     * winner's freshly committed row, sees status 'queued' and claims nothing. The
     * DO UPDATE branch therefore only ever fires for a genuine retry of a failed job.
     */
    const { rows: claimed } = await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image)
       SELECT $1, 'queued', 'fal', $2, $3
       WHERE (SELECT count(*) FROM product_models WHERE created_at > now() - interval '1 day') < $4
       ON CONFLICT (product_id) DO UPDATE SET
         status = 'queued', model_id = $2, source_image = $3, status_url = NULL,
         response_url = NULL, error = NULL, file_name = NULL, created_at = now(), updated_at = now()
       WHERE product_models.status = 'failed'
       RETURNING product_id`,
      [p.id, MODEL, image, MAX_PER_DAY],
    );
    if (!claimed[0]) {
      // Either the daily cap is reached, or another request claimed this product first.
      const now = await getModelState(slug);
      return now.status === "none"
        ? { status: "unavailable", reason: "daily 3D generation limit reached" }
        : now;
    }

    const res = await fetch(`${QUEUE}/${MODEL}`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ input_image_url: image, textured_mesh: true }),
    }).catch(() => null);
    const job = res?.ok ? await res.json() : null;
    if (!job?.status_url || !job?.response_url) {
      // fal never accepted the job, so nothing was billed: release the claim so the
      // product can be tried again later. Only our own un-started claim is removed --
      // status_url IS NULL is what distinguishes it from a job already in flight.
      await pool.query(
        `DELETE FROM product_models
          WHERE product_id = $1 AND status = 'queued' AND status_url IS NULL`,
        [p.id],
      );
      return { status: "unavailable", reason: `AI service error${res ? ` (${res.status})` : ""}` };
    }

    await pool.query(
      `UPDATE product_models SET status_url = $2, response_url = $3, updated_at = now()
        WHERE product_id = $1`,
      [p.id, job.status_url, job.response_url],
    );
    return { status: "queued" };
  }

  async function modelFileName(slug: string) {
    const { rows } = await pool.query(
      `SELECT m.file_name FROM product_models m JOIN products p ON p.id = m.product_id
       WHERE p.slug = $1 AND m.status = 'ready'`,
      [slug],
    );
    return (rows[0]?.file_name as string | undefined) ?? null;
  }

  return { getModelState, requestModel, modelFileName };
}
