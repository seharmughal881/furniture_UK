import "server-only";
import { revalidateTag } from "next/cache";
import { BLOCKS, BLOCK_MAP, type BlockGroup } from "../content/blocks";
import { pool } from "../db";
import { requireAdmin } from "./session";

/**
 * Admin reads and writes of editable site content. As elsewhere, **every exported
 * function calls requireAdmin() before touching the pool.**
 *
 * Saving revalidates both the shared "content" tag and the block's own tag, because
 * getContent() caches for hours — without this the owner would save, look at the site,
 * see no change, and reasonably conclude it was broken.
 */

export type BlockSummary = {
  key: string;
  group: BlockGroup;
  label: string;
  description: string;
  edited: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function listBlocks(): Promise<BlockSummary[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT key,
            to_char(updated_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "updatedAt",
            NULLIF(updater_name, '') AS "updatedBy"
     FROM site_content`,
  );
  const saved = new Map(rows.map((r) => [r.key as string, r]));

  return BLOCKS.map((b) => {
    const row = saved.get(b.key);
    return {
      key: b.key,
      group: b.group,
      label: b.label,
      description: b.description,
      edited: Boolean(row),
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/** The current value of one block: what is stored, or its original default. */
export async function getBlockValue(
  key: string,
): Promise<{ value: Record<string, unknown>; edited: boolean } | null> {
  await requireAdmin();
  const block = BLOCK_MAP.get(key);
  if (!block) return null;

  const { rows } = await pool.query(`SELECT data FROM site_content WHERE key = $1`, [key]);
  const stored = rows[0]?.data as Record<string, unknown> | undefined;
  return {
    // Default underneath, so a block that gained a field since this row was saved still
    // shows every input with something sensible in it.
    value: { ...(block.default as Record<string, unknown>), ...(stored ?? {}) },
    edited: Boolean(stored),
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveBlock(key: string, raw: unknown): Promise<SaveResult> {
  const admin = await requireAdmin();
  const block = BLOCK_MAP.get(key);
  if (!block) return { ok: false, error: "Unknown section." };

  const parsed = block.schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      // A list field's issues point at e.g. ["items", 2, "title"]; group them under the
      // list itself so the message lands next to the editor the owner is looking at.
      const field = String(issue.path[0] ?? "form");
      const where = issue.path.length > 1 ? `Item ${Number(issue.path[1]) + 1}: ` : "";
      (fieldErrors[field] ??= []).push(`${where}${issue.message}`);
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  await pool.query(
    `INSERT INTO site_content (key, data, updated_by, updater_name)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (key) DO UPDATE SET
       data = $2::jsonb, updated_at = now(), updated_by = $3, updater_name = $4`,
    [key, JSON.stringify(parsed.data), admin.id, admin.name],
  );

  revalidateTag("content", { expire: 0 });
  revalidateTag(`content:${key}`, { expire: 0 });
  return { ok: true };
}

/** Delete the row, which restores the original wording shipped with the site. */
export async function resetBlock(key: string): Promise<SaveResult> {
  await requireAdmin();
  if (!BLOCK_MAP.has(key)) return { ok: false, error: "Unknown section." };

  const { rowCount } = await pool.query(`DELETE FROM site_content WHERE key = $1`, [key]);
  if (!rowCount) return { ok: false, error: "That section is already set to its original wording." };

  revalidateTag("content", { expire: 0 });
  revalidateTag(`content:${key}`, { expire: 0 });
  return { ok: true };
}
