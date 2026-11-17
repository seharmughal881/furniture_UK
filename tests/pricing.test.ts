import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  type Coupon,
  couponRefusal,
  discountFor,
  isCodeShaped,
  normaliseCode,
  orderTotals,
  refusalMessage,
} from "../src/lib/pricing";

/**
 * The money rules.
 *
 * Every case here is one a customer can actually reach: a code typed in the wrong case, a
 * promotion that ended a second ago, a basket emptied after a fixed-amount code was
 * applied. They are tested at this level because reaching them through the HTTP routes
 * would mean placing real orders against a real clock.
 */

const OMR = (rials: number) => Math.round(rials * 1000);

/** A plain 10%-off code; each test overrides just the field it is about. */
const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: 1,
  code: "TEN",
  kind: "percent",
  value: 10,
  minSubtotalCents: 0,
  maxDiscountCents: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  redemptions: 0,
  oncePerCustomer: false,
  active: true,
  ...over,
});

const money = (c: number) => `OMR ${(c / 1000).toFixed(3)}`;

describe("normaliseCode", () => {
  test("upper-cases and strips every kind of whitespace", () => {
    assert.equal(normaliseCode(" sofa 10 "), "SOFA10");
    assert.equal(normaliseCode("eid\t25"), "EID25");
    assert.equal(normaliseCode("eid 25"), "EID25", "non-breaking space, which is what a paste from Word gives");
  });

  test("is locale-invariant", () => {
    // toLocaleUpperCase under tr-TR turns "i" into a dotted capital, so the same typed
    // code would resolve to two different rows depending on where the server runs.
    assert.equal(normaliseCode("winter"), "WINTER");
    assert.equal(normaliseCode("WINTER"), "WINTER");
  });

  test("survives anything that is not a string", () => {
    for (const bad of [null, undefined, 42, {}, [], true]) {
      assert.equal(normaliseCode(bad), "");
    }
  });
});

describe("isCodeShaped", () => {
  test("accepts realistic codes", () => {
    for (const ok of ["TEN", "EID25", "SUMMER-20", "VIP_1", "A1", "X".repeat(32)]) {
      assert.equal(isCodeShaped(ok), true, ok);
    }
  });

  test("rejects what cannot be a code", () => {
    for (const bad of [
      "",
      "A", // too short
      "X".repeat(33), // too long
      "-LEAD", // must start alphanumeric
      "_LEAD",
      "lower", // normalise() runs first, so anything lowercase here is a bug
      "HAS SPACE",
      "SEMI;COLON",
      "QUO'TE",
      "PER%CENT",
      "٢٥", // Arabic-Indic digits
      "EID%2D25", // a percent-encoded hyphen, not a hyphen
    ]) {
      assert.equal(isCodeShaped(bad), false, JSON.stringify(bad));
    }
  });
});

describe("couponRefusal", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");

  test("accepts a plain live code", () => {
    assert.equal(couponRefusal(coupon(), { subtotalCents: OMR(100), now }), null);
  });

  test("refuses an inactive code", () => {
    assert.equal(couponRefusal(coupon({ active: false }), { subtotalCents: OMR(100), now }), "inactive");
  });

  test("refuses before the start", () => {
    const c = coupon({ startsAt: "2026-11-18T00:00:00Z" });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(100), now }), "not-started");
  });

  test("accepts at the exact start instant", () => {
    const c = coupon({ startsAt: "2026-11-17T12:00:00Z" });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(100), now }), null);
  });

  test("the end instant is exclusive", () => {
    // ends_at is when the promotion stops, not the last moment it works. A code ending at
    // midnight must not still be live at midnight.
    const atEnd = coupon({ endsAt: "2026-11-17T12:00:00Z" });
    assert.equal(couponRefusal(atEnd, { subtotalCents: OMR(100), now }), "expired");

    const aMsLeft = coupon({ endsAt: "2026-11-17T12:00:00.001Z" });
    assert.equal(couponRefusal(aMsLeft, { subtotalCents: OMR(100), now }), null);
  });

  test("accepts Date objects as well as strings, which is what pg hands back", () => {
    const c = coupon({ startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-12-01T00:00:00Z") });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(100), now }), null);
  });

  test("an unparseable date is ignored rather than throwing", () => {
    const c = coupon({ startsAt: "not a date", endsAt: "also not a date" });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(100), now }), null);
  });

  test("refuses once the allowance is spent", () => {
    assert.equal(
      couponRefusal(coupon({ maxRedemptions: 50, redemptions: 50 }), { subtotalCents: OMR(100), now }),
      "exhausted",
    );
    assert.equal(
      couponRefusal(coupon({ maxRedemptions: 50, redemptions: 49 }), { subtotalCents: OMR(100), now }),
      null,
      "the last one is still available",
    );
  });

  test("already-used only bites when the code says one per customer", () => {
    const opts = { subtotalCents: OMR(100), now, alreadyUsed: true };
    assert.equal(couponRefusal(coupon({ oncePerCustomer: true }), opts), "already-used");
    assert.equal(couponRefusal(coupon({ oncePerCustomer: false }), opts), null);
  });

  test("refuses below the minimum spend", () => {
    const c = coupon({ minSubtotalCents: OMR(75) });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(75) - 1, now }), "below-minimum", "one baisa short");
    assert.equal(couponRefusal(c, { subtotalCents: OMR(75), now }), null, "exactly the minimum qualifies");
  });

  test("a hard refusal is reported ahead of a fixable one", () => {
    // Being told "spend more" about a code that expired last week would send a shopper
    // off to add items for a discount they cannot have.
    const c = coupon({ endsAt: "2026-01-01T00:00:00Z", minSubtotalCents: OMR(500) });
    assert.equal(couponRefusal(c, { subtotalCents: OMR(10), now }), "expired");
  });

  test("a negative or absurd subtotal cannot clear a minimum", () => {
    const c = coupon({ minSubtotalCents: OMR(75) });
    for (const subtotal of [-1, Number.NaN, -100000]) {
      assert.equal(couponRefusal(c, { subtotalCents: subtotal, now }), "below-minimum", String(subtotal));
    }
  });
});

describe("discountFor", () => {
  test("a percentage of a real basket", () => {
    // The OSLO sofa at OMR 185.000 with the 5% the client's own site shows.
    assert.deepEqual(discountFor(coupon({ value: 5 }), OMR(185)), { discountCents: 9250, freeShipping: false });
  });

  test("rounds to the nearest baisa rather than flooring", () => {
    // 7.5% of OMR 185.000 is 13.875 exactly; a fractional case must not quietly short the
    // customer. 1 baisa of OMR 0.015 at 50% is 7.5 baisa -> 8.
    assert.equal(discountFor(coupon({ value: 7.5 }), OMR(185)).discountCents, 13875);
    assert.equal(discountFor(coupon({ value: 50 }), 15).discountCents, 8);
  });

  test("honours the maximum on a percentage", () => {
    const c = coupon({ value: 10, maxDiscountCents: OMR(25) });
    assert.equal(discountFor(c, OMR(1000)).discountCents, OMR(25), "capped");
    assert.equal(discountFor(c, OMR(100)).discountCents, OMR(10), "under the cap, untouched");
  });

  test("a fixed amount larger than the basket is clamped to the basket", () => {
    // Otherwise the total goes negative and the orders table rejects the insert, turning
    // a sensible refusal into a 500.
    const c = coupon({ kind: "fixed", value: OMR(50) });
    assert.equal(discountFor(c, OMR(20)).discountCents, OMR(20));
    assert.equal(discountFor(c, 0).discountCents, 0);
  });

  test("free delivery discounts nothing off the goods", () => {
    assert.deepEqual(discountFor(coupon({ kind: "free_shipping", value: 0 }), OMR(185)), {
      discountCents: 0,
      freeShipping: true,
    });
  });

  test("a percentage outside 1-100 cannot pay the customer", () => {
    assert.equal(discountFor(coupon({ value: 150 }), OMR(100)).discountCents, OMR(100), "clamped to the whole basket");
    assert.equal(discountFor(coupon({ value: -10 }), OMR(100)).discountCents, 0);
    assert.equal(discountFor(coupon({ value: Number.NaN }), OMR(100)).discountCents, 0);
  });

  test("rubbish money in gives zero out, never a NaN total", () => {
    for (const subtotal of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const d = discountFor(coupon(), subtotal);
      assert.ok(Number.isInteger(d.discountCents), `${subtotal} -> ${d.discountCents}`);
      assert.equal(d.discountCents, 0);
    }
  });
});

describe("orderTotals", () => {
  test("adds delivery and takes the discount off", () => {
    assert.deepEqual(orderTotals({ subtotalCents: OMR(100), discountCents: OMR(10), shippingCents: OMR(5) }), {
      subtotalCents: OMR(100),
      discountCents: OMR(10),
      shippingCents: OMR(5),
      totalCents: OMR(95),
      deliveryTbc: false,
    });
  });

  test("delivery still to be confirmed is excluded from the total and flagged", () => {
    const t = orderTotals({ subtotalCents: OMR(40), discountCents: 0, shippingCents: null });
    assert.equal(t.totalCents, OMR(40));
    assert.equal(t.deliveryTbc, true);
  });

  test("free delivery is not the same as unquoted delivery", () => {
    const free = orderTotals({ subtotalCents: OMR(100), discountCents: 0, shippingCents: 0 });
    assert.equal(free.deliveryTbc, false);
    assert.equal(free.totalCents, OMR(100));
  });

  test("a discount can never exceed the basket", () => {
    const t = orderTotals({ subtotalCents: OMR(20), discountCents: OMR(50), shippingCents: 0 });
    assert.equal(t.discountCents, OMR(20));
    assert.equal(t.totalCents, 0);
  });

  test("the total is never negative, whatever goes in", () => {
    const t = orderTotals({ subtotalCents: -100, discountCents: -50, shippingCents: -10 });
    assert.equal(t.totalCents, 0);
    assert.ok(t.totalCents >= 0);
  });
});

describe("refusalMessage", () => {
  test("an unknown and a switched-off code are indistinguishable", () => {
    // Telling the two apart turns the coupon box into an oracle that confirms which codes
    // exist, which is precisely what someone enumerating them wants.
    assert.equal(refusalMessage("unknown", money), refusalMessage("inactive", money));
  });

  test("the minimum-spend message says how much more", () => {
    assert.match(refusalMessage("below-minimum", money, OMR(25)), /OMR 25\.000/);
  });

  test("every reason has a sentence", () => {
    for (const r of ["unknown", "inactive", "not-started", "expired", "exhausted", "already-used", "below-minimum"] as const) {
      assert.ok(refusalMessage(r, money, 1000).length > 10, r);
    }
  });
});
