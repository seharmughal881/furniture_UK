import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { describeDays, describeQuote, NATIONWIDE, quoteShipping, type ShippingZone } from "../src/lib/shipping";

const OMR = (rials: number) => Math.round(rials * 1000);
const money = (c: number) => `OMR ${(c / 1000).toFixed(3)}`;

const zone = (over: Partial<ShippingZone> = {}): ShippingZone => ({
  governorate: "Muscat",
  feeCents: null,
  freeOverCents: OMR(75),
  minDays: 4,
  maxDays: 6,
  active: true,
  ...over,
});

describe("describeDays", () => {
  test("a range, a single day and same-day", () => {
    assert.equal(describeDays(4, 6), "4–6 days");
    assert.equal(describeDays(5, 5), "5 days");
    assert.equal(describeDays(1, 1), "1 day");
    assert.equal(describeDays(0, 0), "Same day");
  });

  test("a back-to-front range reads forwards", () => {
    // A row edited to min 6 / max 4 would otherwise print "6–4 days".
    assert.equal(describeDays(6, 4), "6 days");
  });

  test("fractions and negatives are tidied, never printed raw", () => {
    assert.equal(describeDays(3.4, 6.6), "3–7 days");
    assert.equal(describeDays(-2, 3), "0–3 days");
  });
});

describe("quoteShipping", () => {
  test("no zone means no quote", () => {
    assert.equal(quoteShipping(null, OMR(100)), null);
  });

  test("free once the basket clears the threshold", () => {
    const q = quoteShipping(zone(), OMR(100))!;
    assert.equal(q.free, true);
    assert.equal(q.feeCents, 0);
    assert.equal(q.remainingForFreeCents, 0);
  });

  test("the threshold itself is enough", () => {
    assert.equal(quoteShipping(zone(), OMR(75))!.free, true);
    assert.equal(quoteShipping(zone(), OMR(75) - 1)!.free, false, "one baisa short is still short");
  });

  test("below the threshold, it says how much more", () => {
    const q = quoteShipping(zone(), OMR(50))!;
    assert.equal(q.free, false);
    assert.equal(q.remainingForFreeCents, OMR(25));
    assert.equal(q.feeCents, null, "the seeded zones quote by phone");
  });

  test("a zone with a real fee returns it below the threshold", () => {
    const q = quoteShipping(zone({ feeCents: OMR(8) }), OMR(50))!;
    assert.equal(q.feeCents, OMR(8));
    assert.equal(q.free, false);
  });

  test("a zone that is free for everyone", () => {
    const q = quoteShipping(zone({ freeOverCents: 0 }), 0)!;
    assert.equal(q.free, true);
    assert.equal(q.remainingForFreeCents, 0);
  });

  test("a switched-off governorate is unavailable, not merely expensive", () => {
    const q = quoteShipping(zone({ active: false }), OMR(1000))!;
    assert.equal(q.available, false);
    assert.equal(q.feeCents, null);
    assert.equal(q.free, false, "a big basket must not make an undeliverable zone look free");
  });

  test("a free-delivery code beats a fee that is normally quoted by phone", () => {
    // The whole point of such a code: it has to turn an unknown fee into a known zero, or
    // "free delivery" still leaves the customer waiting for a call about a charge.
    const q = quoteShipping(zone(), OMR(10), { freeShippingCoupon: true })!;
    assert.equal(q.feeCents, 0);
    assert.equal(q.free, true);
    assert.equal(q.byCoupon, true);
    assert.equal(q.remainingForFreeCents, 0);
  });

  test("a free-delivery code still cannot deliver to a switched-off governorate", () => {
    const q = quoteShipping(zone({ active: false }), OMR(10), { freeShippingCoupon: true })!;
    assert.equal(q.available, false);
  });

  test("a nonsense subtotal is floored to zero rather than trusted", () => {
    for (const bad of [-1, Number.NaN, -99999]) {
      const q = quoteShipping(zone(), bad)!;
      assert.equal(q.free, false);
      assert.equal(q.remainingForFreeCents, OMR(75));
    }
  });

  test("the nationwide fallback matches the shop's published terms", () => {
    // What a shopper sees before they ever open the estimator.
    assert.equal(NATIONWIDE.freeOverCents, OMR(75));
    assert.equal(quoteShipping(NATIONWIDE, OMR(80))!.feeCents, 0);
    assert.equal(quoteShipping(NATIONWIDE, OMR(20))!.feeCents, null);
    assert.equal(quoteShipping(NATIONWIDE, 0)!.days, "4–6 days");
  });
});

describe("describeQuote", () => {
  test("every state reads as a sentence a shopper can act on", () => {
    assert.equal(describeQuote(null, money), "Choose a governorate for a delivery estimate");
    assert.equal(describeQuote(quoteShipping(zone(), OMR(100)), money), "Free");
    assert.equal(describeQuote(quoteShipping(zone(), OMR(10)), money), "Confirmed by phone");
    assert.equal(describeQuote(quoteShipping(zone({ feeCents: OMR(8) }), OMR(10)), money), "OMR 8.000");
    assert.equal(describeQuote(quoteShipping(zone(), OMR(10), { freeShippingCoupon: true }), money), "Free with your code");
    assert.match(describeQuote(quoteShipping(zone({ active: false }), OMR(10)), money), /don't deliver/);
  });
});
