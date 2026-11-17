import "server-only";
import type { PoolClient } from "pg";
import { pool } from "./db";
import type { ShippingZone } from "./shipping";

/**
 * Reading `shipping_zones`. Split from shipping.ts so the quoting rules stay importable
 * by the browser bundle and by tests without pulling in `pg`.
 */

const COLUMNS = `governorate,
                 fee_cents AS "feeCents",
                 free_over_cents AS "freeOverCents",
                 min_days AS "minDays",
                 max_days AS "maxDays",
                 active`;

/**
 * One zone by name, or null when the name is not a governorate we hold terms for.
 *
 * Matched case-insensitively on the exact name rather than with LIKE: these rows are
 * seeded from the same GOVERNORATES list the checkout form offers, so anything that does
 * not match one exactly is a forged value, and a forged value must find nothing.
 */
export async function getZone(governorate: string, db: PoolClient | typeof pool = pool): Promise<ShippingZone | null> {
  if (!governorate || governorate.length > 60) return null;
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM shipping_zones WHERE lower(governorate) = lower($1)`, [
    governorate,
  ]);
  return rows[0] ?? null;
}

/** Every zone, for the estimator's dropdown and the admin screen. */
export async function listZones(): Promise<ShippingZone[]> {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM shipping_zones ORDER BY governorate`);
  return rows;
}
