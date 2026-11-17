import "server-only";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { type Coupon, couponRefusal, discountFor, orderTotals } from "./pricing";
import { NATIONWIDE, quoteShipping } from "./shipping";
import { getZone } from "./shipping-data";
import { cartSavings, EMPTY_CART, type Cart, type CartCoupon } from "./types";
import { isUuid } from "./validation";

const COOKIE = "atelier_cart";

/** The longest note a customer may attach. Also enforced by cartNoteSchema. */
export const MAX_NOTE = 500;

/** The cart id from the cookie, if it points at a real cart. */
export async function currentCartId(): Promise<string | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !isUuid(id)) return null;
  const { rows } = await pool.query("SELECT id FROM carts WHERE id = $1", [id]);
  return rows[0]?.id ?? null;
}

/** The current cart id, creating a cart (and cookie) when there is none. */
export async function ensureCartId(): Promise<string> {
  const existing = await currentCartId();
  if (existing) return existing;
  const { rows } = await pool.query("INSERT INTO carts DEFAULT VALUES RETURNING id");
  (await cookies()).set(COOKIE, rows[0].id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return rows[0].id;
}

export async function clearCartCookie() {
  (await cookies()).delete(COOKIE);
}

/** What the carts row itself holds, alongside its lines. */
type CartMeta = {
  note: string;
  shipGovernorate: string;
  coupon: Coupon | null;
};

async function readMeta(cartId: string, db: PoolClient | typeof pool): Promise<CartMeta> {
  const { rows } = await db.query(
    `SELECT c.note, c.ship_governorate AS "shipGovernorate",
            co.id, co.code, co.kind, co.value,
            co.min_subtotal_cents AS "minSubtotalCents",
            co.max_discount_cents AS "maxDiscountCents",
            co.starts_at AS "startsAt", co.ends_at AS "endsAt",
            co.max_redemptions AS "maxRedemptions", co.redemptions,
            co.once_per_customer AS "oncePerCustomer", co.active
       FROM carts c
       LEFT JOIN coupons co ON co.id = c.coupon_id
      WHERE c.id = $1`,
    [cartId],
  );
  const r = rows[0];
  if (!r) return { note: "", shipGovernorate: "", coupon: null };
  return {
    note: r.note ?? "",
    shipGovernorate: r.shipGovernorate ?? "",
    coupon: r.id
      ? {
          id: r.id,
          code: r.code,
          kind: r.kind,
          value: r.value,
          minSubtotalCents: r.minSubtotalCents,
          maxDiscountCents: r.maxDiscountCents,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          maxRedemptions: r.maxRedemptions,
          redemptions: r.redemptions,
          oncePerCustomer: r.oncePerCustomer,
          active: r.active,
        }
      : null,
  };
}

/** Cart contents with prices always taken from the products table. */
export async function readCart(cartId: string | null, db: PoolClient | typeof pool = pool): Promise<Cart> {
  if (!cartId) return EMPTY_CART;
  const { rows } = await db.query(
    `SELECT ci.id, p.id AS "productId", p.slug, p.name, p.name_ar AS "nameAr", p.kind,
            p.images[1] AS image, ci.variant,
            COALESCE((SELECT (v->>'price_cents')::int FROM jsonb_array_elements(p.variants) v
                      WHERE v->>'title' = ci.variant AND ci.variant <> '' LIMIT 1), p.price_cents) AS "unitPriceCents",
            -- The was-price must come from the SAME place as the price above, so the saving
            -- shown at checkout is real. A variant that exists but carries no compare_at is
            -- simply not on offer, so it must NOT fall back to the product's was-price.
            CASE WHEN ci.variant <> ''
                  AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.variants) v WHERE v->>'title' = ci.variant)
                 THEN (SELECT (v->>'compare_at_cents')::int FROM jsonb_array_elements(p.variants) v
                       WHERE v->>'title' = ci.variant LIMIT 1)
                 ELSE p.compare_at_cents
            END AS "compareAtCents",
            p.lead_time_weeks AS "leadTimeWeeks", ci.quantity,
            json_build_object('fabric', ci.fabric, 'wood', ci.wood, 'metal', ci.metal) AS config
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     -- p.active matters as much here as it does in the add-to-cart INSERT. Without it a
     -- product archived *after* it was added stays in the basket and goes through
     -- checkout, because this is the only place the price and lines are ever read.
     WHERE ci.cart_id = $1 AND p.active ORDER BY ci.id`,
    [cartId],
  );

  const subtotalCents = rows.reduce((n, r) => n + r.quantity * r.unitPriceCents, 0);
  const meta = await readMeta(cartId, db);

  /*
   * A coupon is re-tested on every single read, never trusted because it was accepted
   * once. Between applying it and checking out, the basket can shrink below the minimum
   * spend, the promotion can end, and an admin can switch the code off -- so a coupon
   * that no longer qualifies simply stops appearing, and the total goes back up in front
   * of the shopper instead of being quietly honoured.
   *
   * The row is left attached to the cart rather than deleted here: a read must not write,
   * and if the shopper adds another item and clears the minimum again, their code comes
   * back by itself.
   */
  let coupon: CartCoupon | null = null;
  let discountCents = 0;
  let freeShipping = false;
  if (meta.coupon && !couponRefusal(meta.coupon, { subtotalCents, now: Date.now() })) {
    const d = discountFor(meta.coupon, subtotalCents);
    discountCents = d.discountCents;
    freeShipping = d.freeShipping;
    coupon = {
      code: meta.coupon.code,
      kind: meta.coupon.kind,
      discountCents: d.discountCents,
      freeShipping: d.freeShipping,
    };
  }

  /*
   * No governorate chosen yet falls back to the nationwide terms rather than to "no
   * quote". Most shoppers never open the estimator, and for them the drawer must go on
   * saying what it has always said -- free over OMR 75 -- instead of going blank because
   * a new feature they did not use has no answer for them.
   *
   * A governorate that is set but has no row (renamed, or deleted by an admin) falls back
   * the same way: unknown terms are better served by the published nationwide policy than
   * by an empty delivery line.
   */
  const zone = (meta.shipGovernorate ? await getZone(meta.shipGovernorate, db) : null) ?? NATIONWIDE;
  const shipping = quoteShipping(zone, subtotalCents, { freeShippingCoupon: freeShipping });
  const totals = orderTotals({ subtotalCents, discountCents, shippingCents: shipping?.feeCents ?? null });

  return {
    lines: rows,
    count: rows.reduce((n, r) => n + r.quantity, 0),
    subtotalCents,
    savingsCents: cartSavings(rows),
    note: meta.note,
    coupon,
    shipping,
    shipGovernorate: meta.shipGovernorate,
    discountCents: totals.discountCents,
    // Delivery that is still to be confirmed is not added in, so the figure shown is one
    // the customer can rely on as a floor rather than a guess that may rise.
    totalCents: totals.totalCents,
    deliveryTbc: totals.deliveryTbc,
  };
}
