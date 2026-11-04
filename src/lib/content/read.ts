import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { pool } from "../db";
import { BLOCK_MAP } from "./blocks";

/**
 * Reads one editable content block for the storefront.
 *
 * Cached for hours under the "content" tag, like the catalogue readers in catalog.ts, and
 * invalidated by the admin save action — so an edit shows up at once rather than whenever
 * the cache happens to expire.
 *
 * Three things make this safe to call from any component:
 *
 *   1. A block with no row returns its default, which is the content that used to be
 *      hardcoded. Nothing changes until the owner edits something.
 *   2. The stored JSON is re-validated against the block's schema on the way out, not
 *      just on the way in. A row written by an older version of the code, or edited
 *      directly in the database, cannot crash a page with a missing field — it falls back
 *      to the default instead.
 *   3. The default is merged underneath the stored value, so a block that gains a new
 *      field later still renders for rows saved before that field existed.
 */
export async function getContent<T>(key: string): Promise<T> {
  "use cache";
  cacheLife("hours");
  cacheTag("content", `content:${key}`);

  const block = BLOCK_MAP.get(key);
  if (!block) throw new Error(`Unknown content block: ${key}`);

  const { rows } = await pool.query(`SELECT data FROM site_content WHERE key = $1`, [key]);
  if (!rows[0]) return block.default as T;

  const stored = rows[0].data as Record<string, unknown>;
  const merged = { ...(block.default as Record<string, unknown>), ...stored };
  const parsed = block.schema.safeParse(merged);
  if (parsed.success) return parsed.data as T;

  // Keeping the page up matters more than honouring a row we cannot trust. The admin
  // form validates with the same schema, so this is only reachable for a row written
  // outside it.
  console.error(`[content] stored block "${key}" failed validation; using the default`);
  return block.default as T;
}
