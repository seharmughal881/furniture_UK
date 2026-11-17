import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { type Coupon, couponRefusal, type CouponRefusal, discountFor, isCodeShaped, normaliseCode } from "./pricing";

/**
 * Reading, applying and redeeming discount codes.
 *
 * The split that matters: *applying* a code to a basket is a preview and changes nothing
 * a shopper could spend, while *redeeming* one happens inside the checkout transaction
 * and is the only thing that moves a counter. Shopify-style carts that increment on apply
 * leak their whole promotion budget to anyone who adds and removes a code in a loop.
 */

const COLUMNS = `id, code, kind, value,
                 min_subtotal_cents AS "minSubtotalCents",
                 max_discount_cents AS "maxDiscountCents",
                 starts_at AS "startsAt", ends_at AS "endsAt",
                 max_redemptions AS "maxRedemptions", redemptions,
                 once_per_customer AS "oncePerCustomer", active`;

/**
 * One customer, as an opaque key.
 *
 * The last 8 digits of the phone number, which is the whole number in Oman however it was
 * typed -- "9123 4567", "+968 9123 4567" and "0096891234567" all reduce to the same
 * eight. The orders table already indexes phone numbers this way, so the two agree about
 * what "the same customer" means.
 *
 * Then salted and hashed, so coupon_redemptions holds no phone number. Same salt and
 * algorithm as rate-limit.ts, for one definition of how this codebase pseudonymises a
 * person.
 */
export function customerKey(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const salt = process.env.ADMIN_SESSION_SALT ?? "";
  return createHash("sha256").update(`${salt}:coupon:${digits.slice(-8)}`).digest("hex").slice(0, 32);
}

/** The coupon with this code, whatever its state. null when no such code exists. */
export async function findCoupon(rawCode: string, db: PoolClient | typeof pool = pool): Promise<Coupon | null> {
  const code = normaliseCode(rawCode);
  // Saves a query on obvious rubbish, and keeps anything strange out of the parameter.
  if (!isCodeShaped(code)) return null;
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM coupons WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

/**
 * The same read, but taking a lock on the row.
 *
 * Used only inside the checkout transaction. Two shoppers racing for the last redemption
 * of a code both reach this line; the second waits here until the first has committed or
 * rolled back, and therefore sees the incremented counter rather than the stale one.
 */
async function lockCoupon(client: PoolClient, id: number): Promise<Coupon | null> {
  const { rows } = await client.query(`SELECT ${COLUMNS} FROM coupons WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

/** Whether this customer has already redeemed this coupon. */
async function alreadyRedeemed(db: PoolClient | typeof pool, couponId: number, phoneHash: string): Promise<boolean> {
  if (!phoneHash) return false;
  const { rowCount } = await db.query(
    "SELECT 1 FROM coupon_redemptions WHERE coupon_id = $1 AND phone_hash = $2 LIMIT 1",
    [couponId, phoneHash],
  );
  return (rowCount ?? 0) > 0;
}

export type ApplyResult =
  | { ok: true; coupon: Coupon; discountCents: number; freeShipping: boolean }
  | { ok: false; reason: CouponRefusal; shortfallCents: number };

/**
 * Check a code against a basket without committing anything.
 *
 * Note what is NOT done here: no counter moves, and the "has this customer used it
 * before" test is skipped, because at basket time there is no phone number to test
 * against -- the shopper has not reached the address form. A once-per-customer code is
 * therefore accepted into the basket and can still be refused at checkout. That is the
 * right way round: refusing at checkout shows a clear message on a page where the
 * customer can act, whereas asking for a phone number to validate a coupon would be a
 * strange thing for a shop to do.
 */
export async function checkCoupon(rawCode: string, subtotalCents: number, now = Date.now()): Promise<ApplyResult> {
  const coupon = await findCoupon(rawCode);
  if (!coupon) return { ok: false, reason: "unknown", shortfallCents: 0 };

  const reason = couponRefusal(coupon, { subtotalCents, now });
  if (reason) {
    return {
      ok: false,
      reason,
      shortfallCents: Math.max(0, coupon.minSubtotalCents - subtotalCents),
    };
  }
  const { discountCents, freeShipping } = discountFor(coupon, subtotalCents);
  return { ok: true, coupon, discountCents, freeShipping };
}

export type PreparedCoupon =
  | { ok: true; coupon: Coupon; phoneHash: string; discountCents: number; freeShipping: boolean }
  | { ok: false; reason: CouponRefusal; shortfallCents: number };

/**
 * Lock a coupon and work out what it is worth, as the first step of a checkout.
 *
 * Split from the commit below because of an ordering problem: the order row cannot be
 * written until the discount is known, and the redemption row cannot be written until the
 * order exists. So this step takes the lock and answers "how much", the order is
 * inserted, and commitRedemption() then moves the counter -- all inside the caller's
 * single transaction, with the row lock held throughout. A second checkout racing for the
 * last redemption blocks on the SELECT ... FOR UPDATE here until the first has committed,
 * and then sees the counter it actually needs to see.
 */
export async function prepareCoupon(
  client: PoolClient,
  input: { couponId: number; phone: string; subtotalCents: number; now?: number },
): Promise<PreparedCoupon> {
  const now = input.now ?? Date.now();
  const coupon = await lockCoupon(client, input.couponId);
  if (!coupon) return { ok: false, reason: "unknown", shortfallCents: 0 };

  const phoneHash = customerKey(input.phone);
  const used = coupon.oncePerCustomer && (await alreadyRedeemed(client, coupon.id, phoneHash));

  const reason = couponRefusal(coupon, { subtotalCents: input.subtotalCents, now, alreadyUsed: used });
  if (reason) {
    return { ok: false, reason, shortfallCents: Math.max(0, coupon.minSubtotalCents - input.subtotalCents) };
  }

  const { discountCents, freeShipping } = discountFor(coupon, input.subtotalCents);
  return { ok: true, coupon, phoneHash, discountCents, freeShipping };
}

export type CommitResult = { ok: true } | { ok: false; reason: CouponRefusal };

/**
 * Take the redemption, once the order it belongs to exists.
 *
 * Two defences beyond the lock prepareCoupon() is still holding, because a lock alone
 * assumes every writer takes it:
 *   - the conditional UPDATE re-tests the cap at the instant of writing, so no path can
 *     push the counter past max_redemptions even if it skipped the lock;
 *   - the partial unique index on coupon_redemptions enforces once-per-customer in the
 *     database itself, so two tabs belonging to the same shopper fail on the insert
 *     rather than on a check that passed a moment earlier.
 *
 * A false result must be treated as fatal by the caller: an order quoted with a discount
 * that cannot be redeemed has to be rolled back, never silently repriced upwards.
 */
export async function commitRedemption(
  client: PoolClient,
  input: { coupon: Coupon; orderId: string; phoneHash: string; discountCents: number },
): Promise<CommitResult> {
  const bumped = await client.query(
    `UPDATE coupons SET redemptions = redemptions + 1
      WHERE id = $1 AND active
        AND (max_redemptions IS NULL OR redemptions < max_redemptions)`,
    [input.coupon.id],
  );
  if (bumped.rowCount === 0) return { ok: false, reason: "exhausted" };

  try {
    await client.query(
      `INSERT INTO coupon_redemptions (coupon_id, order_id, phone_hash, discount_cents)
       VALUES ($1, $2, $3, $4)`,
      // '' for a coupon with no per-customer rule: that row then sits outside the partial
      // unique index, and the shop keeps no customer identifier it has no use for.
      [input.coupon.id, input.orderId, input.coupon.oncePerCustomer ? input.phoneHash : "", input.discountCents],
    );
  } catch (err) {
    // 23505 = unique_violation: another transaction redeemed this coupon for this same
    // customer first. Reported as the business rule it is, not as a 500.
    if ((err as { code?: string }).code === "23505") return { ok: false, reason: "already-used" };
    throw err;
  }
  return { ok: true };
}

/** Attach a coupon to a basket (or clear it with null). */
export async function setCartCoupon(cartId: string, couponId: number | null): Promise<void> {
  await pool.query("UPDATE carts SET coupon_id = $2, updated_at = now() WHERE id = $1", [cartId, couponId]);
}
