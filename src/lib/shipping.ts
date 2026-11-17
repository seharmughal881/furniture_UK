/**
 * Delivery quotes per governorate.
 *
 * Pure, like pricing.ts: a zone row and a subtotal go in, a quote comes out. The database
 * access lives in shipping-data.ts so this file can be imported by a test, by a server
 * route and by the basket drawer without dragging `pg` into the browser bundle.
 */

import { DELIVERY } from "./types";

/** One row of `shipping_zones`. */
export type ShippingZone = {
  governorate: string;
  /** Baisa. null means the team quotes it by phone -- see db/schema.sql v12. */
  feeCents: number | null;
  freeOverCents: number;
  minDays: number;
  maxDays: number;
  active: boolean;
};

export type ShippingQuote = {
  governorate: string;
  /** 0 = free, a positive number = that fee, null = confirmed by phone. */
  feeCents: number | null;
  free: boolean;
  /** Baisa still to spend before delivery is free; 0 when it already is, or unreachable. */
  remainingForFreeCents: number;
  /** "4–6 days", or "5 days" when the range is a single value. */
  days: string;
  /** False when the shop does not currently deliver to this governorate at all. */
  available: boolean;
  /** True when a free-delivery coupon, not the basket value, is why this is free. */
  byCoupon: boolean;
};

/**
 * The terms that apply before the shopper has said where they are.
 *
 * Exactly the nationwide policy the storefront had before zones existed -- free over
 * OMR 75, otherwise quoted by phone, 4-6 days -- so a customer who never opens the
 * estimator sees what they have always seen. DELIVERY stays the single source of that
 * threshold; this is one more reader of it, not a second copy.
 */
export const NATIONWIDE: ShippingZone = {
  governorate: "",
  feeCents: null,
  freeOverCents: DELIVERY.freeOverCents,
  minDays: 4,
  maxDays: 6,
  active: true,
};

const EN_DASH = "–";

export function describeDays(minDays: number, maxDays: number): string {
  const lo = Math.max(0, Math.round(minDays));
  const hi = Math.max(lo, Math.round(maxDays));
  if (lo === 0 && hi === 0) return "Same day";
  if (lo === hi) return `${lo} ${lo === 1 ? "day" : "days"}`;
  return `${lo}${EN_DASH}${hi} days`;
}

/**
 * What delivery costs for this basket, to this governorate.
 *
 * `freeShippingCoupon` wins over everything, including a zone whose fee is normally
 * quoted by phone. That is the point of such a coupon: it has to turn an unknown fee into
 * a known zero, or "free delivery" would still leave the customer waiting for a call
 * about a delivery charge.
 */
export function quoteShipping(
  zone: ShippingZone | null,
  subtotalCents: number,
  opts: { freeShippingCoupon?: boolean } = {},
): ShippingQuote | null {
  if (!zone) return null;
  const subtotal = Number.isFinite(subtotalCents) && subtotalCents > 0 ? Math.floor(subtotalCents) : 0;
  const days = describeDays(zone.minDays, zone.maxDays);

  if (!zone.active) {
    return {
      governorate: zone.governorate,
      feeCents: null,
      free: false,
      remainingForFreeCents: 0,
      days,
      available: false,
      byCoupon: false,
    };
  }

  if (opts.freeShippingCoupon) {
    return {
      governorate: zone.governorate,
      feeCents: 0,
      free: true,
      remainingForFreeCents: 0,
      days,
      available: true,
      byCoupon: true,
    };
  }

  const earnedFree = subtotal >= zone.freeOverCents;
  return {
    governorate: zone.governorate,
    feeCents: earnedFree ? 0 : zone.feeCents,
    free: earnedFree,
    // Only meaningful while they are below the threshold. Clamped at 0 so a basket already
    // past it never reports a negative "spend this much more".
    remainingForFreeCents: earnedFree ? 0 : Math.max(0, zone.freeOverCents - subtotal),
    days,
    available: true,
    byCoupon: false,
  };
}

/**
 * The sentence shown next to the Delivery row.
 *
 * Kept here rather than in the component so the basket drawer, the checkout summary and
 * the confirmation email cannot word the same quote three different ways.
 */
export function describeQuote(quote: ShippingQuote | null, formatMoney: (cents: number) => string): string {
  if (!quote) return "Choose a governorate for a delivery estimate";
  if (!quote.available) return "We don't deliver to this governorate yet — please call us";
  if (quote.byCoupon) return "Free with your code";
  if (quote.feeCents === 0) return "Free";
  if (quote.feeCents === null) return "Confirmed by phone";
  return formatMoney(quote.feeCents);
}
