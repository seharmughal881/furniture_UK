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

  /** Current state for a product, advancing a queued job if it has finished. */
  async function getModelState(slug: string): Promise<ModelState> {
    const p = await productBySlug(slug);
    if (!p) return { status: "unavailable", reason: "unknown product" };
    const { rows } = await pool.query<Row>(`SELECT * FROM product_models WHERE product_id = $1`, [p.id]);
    const row = rows[0];
    if (!row) return { status: "none" };
    if (row.status === "ready") return { status: "ready", url: fileUrl(p.slug) };
    if (row.status === "failed") return { status: "failed", error: row.error ?? "generation failed" };
    return pollJob(p.id, p.slug, row);
  }

  async function pollJob(productId: number, slug: string, row: Row): Promise<ModelState> {
    if (!aiEnabled() || !row.status_url || !row.response_url) return { status: "queued" };
    const st = await fetch(row.status_url, { headers: auth() }).then((r) => r.json()).catch(() => null);
    if (!st || st.status !== "COMPLETED") return { status: "queued" };
    if (st.error) return fail(productId, String(st.error));
    const result = await fetch(row.response_url, { headers: auth() }).then((r) => r.json()).catch(() => null);
    // Hunyuan 2.1 returns model_glb; the v2 family returns model_mesh
    const glb: string | undefined = result?.model_glb?.url || result?.model_mesh?.url;
    if (!glb) return fail(productId, "no 3D file in the AI response");
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

    const { rows: today } = await pool.query(
      `SELECT count(*)::int AS n FROM product_models WHERE created_at > now() - interval '1 day'`,
    );
    if (today[0].n >= MAX_PER_DAY) return { status: "unavailable", reason: "daily 3D generation limit reached" };

    const image = p.image.includes("cdn.shopify.com") ? `${p.image.split("?")[0]}?width=1024` : p.image;
    const res = await fetch(`${QUEUE}/${MODEL}`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ input_image_url: image, textured_mesh: true }),
    }).catch(() => null);
    const job = res?.ok ? await res.json() : null;
    if (!job?.status_url || !job?.response_url) {
      return { status: "unavailable", reason: `AI service error${res ? ` (${res.status})` : ""}` };
    }
    await pool.query(
      `INSERT INTO product_models (product_id, status, provider, model_id, source_image, status_url, response_url)
       VALUES ($1, 'queued', 'fal', $2, $3, $4, $5)
       ON CONFLICT (product_id) DO UPDATE SET status = 'queued', model_id = $2, source_image = $3,
         status_url = $4, response_url = $5, error = NULL, file_name = NULL, created_at = now(), updated_at = now()`,
      [p.id, MODEL, image, job.status_url, job.response_url],
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
