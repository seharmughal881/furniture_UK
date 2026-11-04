import "server-only";
import { revalidateTag } from "next/cache";
import { pool } from "../db";
import { requireAdmin } from "./session";

/**
 * Showrooms, as rows of the existing `stores` table.
 *
 * Deliberately a real CRUD rather than another content block: the storefront's /stores
 * page already reads this table through getStores(), and moving the data into
 * site_content would orphan a working table and query for no benefit.
 *
 * Saving revalidates the "catalog" tag, because getStores() is cached under it alongside
 * the product readers.
 */

export type Store = {
  id: number;
  slug: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  kind: string;
  sortOrder: number;
};

export type StoreResult = { ok: true } | { ok: false; error: string };

export async function listStores(): Promise<Store[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT id, slug, name, city, address, phone, whatsapp, email, hours, kind,
            sort_order AS "sortOrder"
     FROM stores ORDER BY sort_order, id`,
  );
  return rows as Store[];
}

export type StoreInput = Omit<Store, "id">;

export async function saveStore(id: number | null, input: StoreInput): Promise<StoreResult> {
  await requireAdmin();

  if (!input.name.trim()) return { ok: false, error: "A showroom needs a name." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return { ok: false, error: "The short name must be lowercase letters, numbers and hyphens." };
  }

  const values = [
    input.slug,
    input.name,
    input.city,
    input.address,
    input.phone,
    input.whatsapp,
    input.email,
    input.hours,
    input.kind === "office" ? "office" : "showroom",
    input.sortOrder,
  ];

  try {
    if (id === null) {
      await pool.query(
        `INSERT INTO stores (slug, name, city, address, phone, whatsapp, email, hours, kind, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        values,
      );
    } else {
      const { rowCount } = await pool.query(
        `UPDATE stores SET slug=$1, name=$2, city=$3, address=$4, phone=$5, whatsapp=$6,
                           email=$7, hours=$8, kind=$9, sort_order=$10
         WHERE id=$11`,
        [...values, id],
      );
      if (!rowCount) return { ok: false, error: "Unknown showroom." };
    }
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      return { ok: false, error: "Another showroom already uses that short name." };
    }
    throw err;
  }

  revalidateTag("catalog", { expire: 0 });
  return { ok: true };
}

export async function deleteStore(id: number): Promise<StoreResult> {
  const admin = await requireAdmin();
  if (admin.role !== "manager") return { ok: false, error: "Only a manager can remove a showroom." };
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown showroom." };

  const { rowCount } = await pool.query(`DELETE FROM stores WHERE id = $1`, [id]);
  if (!rowCount) return { ok: false, error: "Unknown showroom." };

  revalidateTag("catalog", { expire: 0 });
  return { ok: true };
}
