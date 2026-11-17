import "server-only";
import { pool } from "../db";
import { normaliseCode } from "../pricing";
import { requireAdmin } from "./session";

/**
 * The back office side of discount codes.
 *
 * Every exported function calls requireAdmin() first, exactly as orders.ts does. The
 * proxy at src/proxy.ts only redirects visitors without a session cookie and never
 * validates it, so this is the real gate.
 */

export type CouponRow = {
  id: number;
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotalCents: number;
  maxDiscountCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  oncePerCustomer: boolean;
  active: boolean;
  note: string;
  createdAt: string;
  /** Money this code has actually given away, from the redemption rows. */
  givenCents: number;
  /** True when the window has closed or the allowance is spent, whatever `active` says. */
  finished: boolean;
};

export async function listCoupons(): Promise<CouponRow[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT c.id, c.code, c.kind, c.value,
            c.min_subtotal_cents AS "minSubtotalCents",
            c.max_discount_cents AS "maxDiscountCents",
            to_char(c.starts_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "startsAt",
            to_char(c.ends_at   AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "endsAt",
            c.max_redemptions AS "maxRedemptions", c.redemptions,
            c.once_per_customer AS "oncePerCustomer", c.active, c.note,
            to_char(c.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY') AS "createdAt",
            COALESCE((SELECT sum(r.discount_cents)::int FROM coupon_redemptions r
                       WHERE r.coupon_id = c.id), 0) AS "givenCents",
            (c.ends_at IS NOT NULL AND c.ends_at <= now())
              OR (c.max_redemptions IS NOT NULL AND c.redemptions >= c.max_redemptions) AS finished
       FROM coupons c
      ORDER BY c.active DESC, c.created_at DESC`,
  );
  return rows;
}

export type CouponResult = { ok: true } | { ok: false; error: string };

export type NewCoupon = {
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotalCents: number;
  maxDiscountCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  oncePerCustomer: boolean;
  note: string;
};

export async function createCoupon(input: NewCoupon): Promise<CouponResult> {
  const admin = await requireAdmin();
  const code = normaliseCode(input.code);
  try {
    await pool.query(
      `INSERT INTO coupons (code, kind, value, min_subtotal_cents, max_discount_cents,
                            starts_at, ends_at, max_redemptions, once_per_customer, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [code, input.kind, input.value, input.minSubtotalCents, input.maxDiscountCents,
       input.startsAt, input.endsAt, input.maxRedemptions, input.oncePerCustomer, input.note, admin.id],
    );
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    // The database's own checks are the backstop for anything the form let through, and
    // each one gets a sentence rather than a 500 page.
    if (e.code === "23505") return { ok: false, error: `The code ${code} already exists.` };
    if (e.constraint === "coupons_value_check") {
      return { ok: false, error: "A percentage must be between 1 and 100, and an amount must be above zero." };
    }
    if (e.constraint === "coupons_window_check") return { ok: false, error: "The end date must be after the start date." };
    if (e.constraint === "coupons_limits_check") return { ok: false, error: "Those limits don't make sense together." };
    throw err;
  }
}

/**
 * Switch a code on or off.
 *
 * Deliberately the main control rather than deletion: switching off stops the code being
 * accepted from the next request, while the orders that used it keep their history and
 * the redemption rows stay put for the audit trail.
 */
export async function setCouponActive(id: number, active: boolean): Promise<CouponResult> {
  await requireAdmin();
  const { rowCount } = await pool.query("UPDATE coupons SET active = $2 WHERE id = $1", [id, active]);
  return rowCount ? { ok: true } : { ok: false, error: "That code no longer exists." };
}

/**
 * Delete a code outright.
 *
 * Refused once it has been redeemed. The redemption rows cascade, so deleting a used code
 * would erase the record of discounts the shop has already given -- and the orders that
 * carry that code would no longer be explainable against any promotion. Switching it off
 * does everything deleting it was meant to do.
 */
export async function deleteCoupon(id: number): Promise<CouponResult> {
  await requireAdmin();
  const { rows } = await pool.query("SELECT redemptions FROM coupons WHERE id = $1", [id]);
  if (!rows[0]) return { ok: false, error: "That code no longer exists." };
  if (rows[0].redemptions > 0) {
    return { ok: false, error: "That code has already been used, so it can only be switched off, not deleted." };
  }
  await pool.query("DELETE FROM coupons WHERE id = $1", [id]);
  return { ok: true };
}
