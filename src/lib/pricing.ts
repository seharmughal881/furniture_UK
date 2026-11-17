/**
 * What a basket costs: discounts, delivery and the order total.
 *
 * Deliberately pure -- no database, no `server-only`, no clock of its own. Every input is
 * a plain value and `now` is passed in. That is what makes it testable (see
 * tests/pricing.test.ts, which covers the rounding and clamping cases that are otherwise
 * only reachable by placing real orders), and it is also why the same functions can run
 * on the server to decide what to charge and in the browser to show the shopper a figure
 * that will match.
 *
 * The server's call is the one that counts. Nothing here is ever trusted from a request
 * body: /api/cart/coupon and /api/checkout both load the coupon row from the database and
 * pass that, so a forged "discountCents" in a POST has nowhere to land.
 */

export type CouponKind = "percent" | "fixed" | "free_shipping";

/** A coupon as the database holds it. Dates are ISO strings or Date; both are accepted. */
export type Coupon = {
  id: number;
  code: string;
  kind: CouponKind;
  /** percent: 1-100. fixed: baisa off the subtotal. free_shipping: 0. */
  value: number;
  minSubtotalCents: number;
  /** Ceiling on a percentage discount, in baisa. null = uncapped. */
  maxDiscountCents: number | null;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  maxRedemptions: number | null;
  redemptions: number;
  oncePerCustomer: boolean;
  active: boolean;
};

/**
 * The shape a code must have before it is worth a database round trip.
 *
 * Letters, digits, hyphen and underscore; 2 to 32 characters; must start alphanumeric.
 * This is the first of the two things that stop the coupon box being used to guess codes
 * -- it rejects nonsense without touching Postgres -- the second being the rate limit in
 * the route.
 */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

/**
 * One spelling of a code.
 *
 * `toUpperCase` rather than `toLocaleUpperCase`: the locale-aware version maps a dotless
 * Turkish i to a different letter under a tr-TR locale, so the same typed code would
 * resolve to two different database rows depending on the server's locale.
 *
 * Internal whitespace is stripped too, because codes get read off printed flyers and
 * typed as "SOFA 10" at least as often as "SOFA10".
 */
export function normaliseCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Whether a normalised code could possibly exist, before asking the database. */
export const isCodeShaped = (code: string) => CODE_SHAPE.test(code);

const asTime = (v: string | Date | null): number | null => {
  if (v === null || v === undefined) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** Money that reached us from somewhere unverified, forced back into a sane integer. */
const safeMoney = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export type CouponRefusal =
  | "unknown"
  | "inactive"
  | "not-started"
  | "expired"
  | "exhausted"
  | "below-minimum"
  | "already-used";

/**
 * Why this coupon cannot be used on this basket, or null when it can.
 *
 * Checked in this order on purpose: a shopper whose basket is OMR 10 short of the minimum
 * should be told that, not told the code is invalid, so the spend-more cases come last
 * and the "this code is not for you" cases come first.
 */
export function couponRefusal(
  coupon: Coupon,
  opts: { subtotalCents: number; now: number | Date; alreadyUsed?: boolean },
): CouponRefusal | null {
  const now = opts.now instanceof Date ? opts.now.getTime() : opts.now;
  const subtotal = safeMoney(opts.subtotalCents);

  if (!coupon.active) return "inactive";

  const starts = asTime(coupon.startsAt);
  if (starts !== null && now < starts) return "not-started";

  const ends = asTime(coupon.endsAt);
  // `>=` not `>`: ends_at is the instant the promotion stops, not the last valid instant.
  if (ends !== null && now >= ends) return "expired";

  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) return "exhausted";

  if (opts.alreadyUsed && coupon.oncePerCustomer) return "already-used";

  if (subtotal < coupon.minSubtotalCents) return "below-minimum";

  return null;
}

/**
 * What a refusal should say to the shopper.
 *
 * "unknown" and "inactive" give the same sentence deliberately. Distinguishing them would
 * turn the coupon box into an oracle that confirms which codes exist, which is exactly
 * what someone enumerating codes wants.
 */
export function refusalMessage(reason: CouponRefusal, formatMoney: (cents: number) => string, shortfallCents = 0): string {
  switch (reason) {
    case "unknown":
    case "inactive":
      return "That code isn't valid. Please check it and try again.";
    case "not-started":
      return "That code isn't active yet.";
    case "expired":
      return "That code has expired.";
    case "exhausted":
      return "That code has been fully claimed.";
    case "already-used":
      return "That code has already been used on a previous order.";
    case "below-minimum":
      return `Spend ${formatMoney(shortfallCents)} more to use this code.`;
  }
}

export type Discount = {
  /** Baisa taken off the subtotal. Never negative, never more than the subtotal. */
  discountCents: number;
  /** True when the coupon pays for delivery rather than discounting the goods. */
  freeShipping: boolean;
};

/**
 * What a valid coupon is worth against this subtotal.
 *
 * Clamped twice over. The cap from the coupon row stops a percentage running away on an
 * expensive bedroom set, and the clamp to the subtotal stops a fixed-amount code worth
 * more than the basket producing a negative total -- which the orders table would reject
 * anyway (orders_discount_check), but as a 500 rather than as a sensible number.
 *
 * Callers must have checked couponRefusal() first; this function answers "how much", not
 * "may they". It still clamps, because an unchecked call must under-discount rather than
 * over-discount.
 */
export function discountFor(coupon: Coupon, subtotalCents: number): Discount {
  const subtotal = safeMoney(subtotalCents);
  if (coupon.kind === "free_shipping") return { discountCents: 0, freeShipping: true };

  const raw =
    coupon.kind === "percent"
      ? // Rounded, not floored: on a OMR 185.000 sofa a 5% discount is 9.250 exactly, but
        // 7.5% would be 13.875 and flooring it would quietly short the customer a baisa.
        Math.round((subtotal * clampPercent(coupon.value)) / 100)
      : safeMoney(coupon.value);

  const capped = coupon.maxDiscountCents === null ? raw : Math.min(raw, safeMoney(coupon.maxDiscountCents));
  return { discountCents: Math.max(0, Math.min(capped, subtotal)), freeShipping: false };
}

/** A percentage outside 1-100 cannot come from the database (coupons_value_check), but a
 *  hand-written test or a future import path could produce one, and 150% off must not
 *  mean the shop pays the customer. */
const clampPercent = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  /** 0 when free, a positive fee, or null when the team confirms it by phone. */
  shippingCents: number | null;
  /** What the customer pays. Delivery that is "to be confirmed" is not in this figure. */
  totalCents: number;
  /** True when totalCents is not yet the final word, because delivery is unquoted. */
  deliveryTbc: boolean;
};

/**
 * The one place the order total is assembled, used by the basket, the checkout summary
 * and /api/checkout alike -- so the three cannot drift apart, which is the usual way a
 * shop ends up charging a different number from the one it displayed.
 */
export function orderTotals(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number | null;
}): Totals {
  const subtotal = safeMoney(input.subtotalCents);
  const discount = Math.min(safeMoney(input.discountCents), subtotal);
  const shipping = input.shippingCents === null ? null : safeMoney(input.shippingCents);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: Math.max(0, subtotal - discount + (shipping ?? 0)),
    deliveryTbc: shipping === null,
  };
}
