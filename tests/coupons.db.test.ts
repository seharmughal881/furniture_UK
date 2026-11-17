import "./helpers/env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { checkCoupon, commitRedemption, customerKey, prepareCoupon } from "../src/lib/coupons";

/**
 * The parts of the coupon rules that only a real database can prove: that two shoppers
 * racing for the last redemption cannot both win, and that the once-per-customer rule
 * survives a race between two tabs belonging to the same person.
 *
 * Runs against whatever DATABASE_URL points at, which is the local Postgres in .env.local.
 * Everything it creates is prefixed ZZTEST and deleted afterwards; deleting the coupons
 * cascades their redemption rows away.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OMR = (rials: number) => Math.round(rials * 1000);

/** Unique per run, so two runs at once (or a crashed one) cannot collide. */
const tag = `ZZTEST${Date.now().toString(36).toUpperCase()}`;
const codes: string[] = [];
const orderIds: string[] = [];

type CouponFields = {
  kind?: "percent" | "fixed" | "free_shipping";
  value?: number;
  minSubtotalCents?: number;
  maxRedemptions?: number | null;
  oncePerCustomer?: boolean;
  active?: boolean;
  endsAt?: string | null;
};

async function makeCoupon(suffix: string, f: CouponFields = {}): Promise<{ id: number; code: string }> {
  const code = `${tag}${suffix}`;
  codes.push(code);
  const { rows } = await pool.query(
    `INSERT INTO coupons (code, kind, value, min_subtotal_cents, max_redemptions, once_per_customer, active, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, code`,
    [code, f.kind ?? "percent", f.value ?? 10, f.minSubtotalCents ?? 0, f.maxRedemptions ?? null,
     f.oncePerCustomer ?? false, f.active ?? true, f.endsAt ?? null],
  );
  return rows[0];
}

/** A minimal order row, because coupon_redemptions must reference a real one. */
async function makeOrder(db: PoolClient | typeof pool, phone: string): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO orders (email, name, phone, address, city, country, shipping_method,
                         subtotal_cents, shipping_cents, total_cents)
     VALUES ('', $1, $2, 'Way 3021', 'Bawshar', 'Oman', 'home-delivery', $3, 0, $3)
     RETURNING id`,
    [`${tag} buyer`, phone, OMR(100)],
  );
  orderIds.push(rows[0].id);
  return rows[0].id;
}

const redemptionCount = async (id: number) =>
  Number((await pool.query("SELECT redemptions FROM coupons WHERE id = $1", [id])).rows[0].redemptions);

before(async () => {
  // Fail loudly rather than silently testing nothing if the database is down.
  await pool.query("SELECT 1");
});

after(async () => {
  // Orders first: their redemption rows go with them, and the coupon delete then has
  // nothing left to cascade. Both are tagged, so nothing real is touched.
  if (orderIds.length) await pool.query("DELETE FROM orders WHERE id = ANY($1::uuid[])", [orderIds]);
  if (codes.length) await pool.query("DELETE FROM coupons WHERE code = ANY($1::text[])", [codes]);
  await pool.end();
});

describe("checkCoupon (the preview the basket does)", () => {
  test("accepts a live code and values it", async () => {
    const { code } = await makeCoupon("OK", { value: 5 });
    const r = await checkCoupon(code, OMR(185));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.discountCents, 9250);
  });

  test("matches whatever case and spacing the shopper types", async () => {
    const { code } = await makeCoupon("CASE");
    for (const typed of [code.toLowerCase(), ` ${code} `, code.replace(/(.{4})/, "$1 ")]) {
      assert.equal((await checkCoupon(typed, OMR(100))).ok, true, typed);
    }
  });

  test("an unknown code is refused without touching anything", async () => {
    const r = await checkCoupon("NOSUCHCODE123", OMR(100));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unknown");
  });

  test("a malformed code never reaches the database", async () => {
    // Belt and braces for the SQL parameter: these are rejected on shape alone.
    for (const bad of ["'; DROP TABLE coupons; --", "a".repeat(200), "", "٢٥"]) {
      const r = await checkCoupon(bad, OMR(100));
      assert.equal(r.ok, false, bad);
    }
    // ...and the table is still there.
    assert.ok((await pool.query("SELECT count(*) FROM coupons")).rows[0]);
  });

  test("reports the shortfall against a minimum spend", async () => {
    const { code } = await makeCoupon("MIN", { minSubtotalCents: OMR(75) });
    const r = await checkCoupon(code, OMR(50));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "below-minimum");
      assert.equal(r.shortfallCents, OMR(25));
    }
  });

  test("applying a code never moves the counter", async () => {
    // The budget leak that Shopify-style "increment on apply" carts have: add and remove
    // in a loop and the promotion is spent without a single order.
    const { id, code } = await makeCoupon("NOBUMP", { maxRedemptions: 1 });
    for (let i = 0; i < 5; i++) await checkCoupon(code, OMR(100));
    assert.equal(await redemptionCount(id), 0);
  });
});

describe("redemption", () => {
  test("a successful redemption increments once and records the amount", async () => {
    const { id } = await makeCoupon("ONE", { value: 10 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderId = await makeOrder(client, "91234567");
      const prep = await prepareCoupon(client, { couponId: id, phone: "91234567", subtotalCents: OMR(100) });
      assert.equal(prep.ok, true);
      if (!prep.ok) return;
      assert.equal(prep.discountCents, OMR(10));

      const done = await commitRedemption(client, {
        coupon: prep.coupon,
        orderId,
        phoneHash: prep.phoneHash,
        discountCents: prep.discountCents,
      });
      assert.equal(done.ok, true);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    assert.equal(await redemptionCount(id), 1);
  });

  test("a rolled-back checkout gives the redemption back", async () => {
    // An order that fails after the counter moved must not quietly consume an allowance.
    const { id } = await makeCoupon("ROLL", { maxRedemptions: 1 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderId = await makeOrder(client, "91234567");
      const prep = await prepareCoupon(client, { couponId: id, phone: "91234567", subtotalCents: OMR(100) });
      if (prep.ok) {
        await commitRedemption(client, { coupon: prep.coupon, orderId, phoneHash: prep.phoneHash, discountCents: 1 });
      }
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    assert.equal(await redemptionCount(id), 0, "the counter is back where it started");
    assert.equal((await checkCoupon((await pool.query("SELECT code FROM coupons WHERE id = $1", [id])).rows[0].code, OMR(100))).ok, true);
  });

  test("two shoppers racing for the last redemption: exactly one wins", async () => {
    const { id } = await makeCoupon("RACE", { maxRedemptions: 1 });
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query("BEGIN");
      await b.query("BEGIN");

      // A takes the row lock first.
      const prepA = await prepareCoupon(a, { couponId: id, phone: "91111111", subtotalCents: OMR(100) });
      assert.equal(prepA.ok, true);

      // B now asks for the same row and blocks inside SELECT ... FOR UPDATE. Started, not
      // awaited: awaiting it here would deadlock the test against A's open transaction.
      const pendingB = prepareCoupon(b, { couponId: id, phone: "92222222", subtotalCents: OMR(100) });

      if (prepA.ok) {
        const orderA = await makeOrder(a, "91111111");
        const doneA = await commitRedemption(a, {
          coupon: prepA.coupon,
          orderId: orderA,
          phoneHash: prepA.phoneHash,
          discountCents: prepA.discountCents,
        });
        assert.equal(doneA.ok, true);
      }
      await a.query("COMMIT");

      // B unblocks only now, and sees the committed counter rather than the stale one.
      const prepB = await pendingB;
      assert.equal(prepB.ok, false, "the second shopper is refused");
      if (!prepB.ok) assert.equal(prepB.reason, "exhausted");
      await b.query("ROLLBACK");
    } finally {
      a.release();
      b.release();
    }
    assert.equal(await redemptionCount(id), 1, "never more than the allowance");
  });

  test("the cap holds even when the lock is bypassed entirely", async () => {
    // commitRedemption's conditional UPDATE is the defence that does not depend on anyone
    // having taken the lock first, so it is tested without one.
    const { id } = await makeCoupon("CAP", { maxRedemptions: 2 });
    const { rows } = await pool.query("SELECT id, code, kind, value, once_per_customer AS \"oncePerCustomer\" FROM coupons WHERE id = $1", [id]);
    const coupon = { ...rows[0], minSubtotalCents: 0, maxDiscountCents: null, startsAt: null, endsAt: null, maxRedemptions: 2, redemptions: 0, active: true };

    let accepted = 0;
    for (let i = 0; i < 5; i++) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const orderId = await makeOrder(client, `9123456${i}`);
        const r = await commitRedemption(client, { coupon, orderId, phoneHash: "", discountCents: 1 });
        if (r.ok) accepted++;
        await client.query(r.ok ? "COMMIT" : "ROLLBACK");
      } finally {
        client.release();
      }
    }
    assert.equal(accepted, 2, "five attempts, an allowance of two");
    assert.equal(await redemptionCount(id), 2);
  });
});

describe("one use per customer", () => {
  test("the same phone number is refused the second time", async () => {
    const { id } = await makeCoupon("ONCE", { oncePerCustomer: true });

    const first = await pool.connect();
    try {
      await first.query("BEGIN");
      const orderId = await makeOrder(first, "99887766");
      const prep = await prepareCoupon(first, { couponId: id, phone: "99887766", subtotalCents: OMR(100) });
      assert.equal(prep.ok, true);
      if (prep.ok) {
        await commitRedemption(first, { coupon: prep.coupon, orderId, phoneHash: prep.phoneHash, discountCents: 1 });
      }
      await first.query("COMMIT");
    } finally {
      first.release();
    }

    const second = await pool.connect();
    try {
      await second.query("BEGIN");
      // Typed differently, but it is the same person -- which is the point.
      const prep = await prepareCoupon(second, { couponId: id, phone: "+968 9988 7766", subtotalCents: OMR(100) });
      assert.equal(prep.ok, false);
      if (!prep.ok) assert.equal(prep.reason, "already-used");
      await second.query("ROLLBACK");
    } finally {
      second.release();
    }
  });

  test("a different customer is unaffected", async () => {
    const { id } = await makeCoupon("ONCE2", { oncePerCustomer: true });
    for (const phone of ["91111111", "92222222"]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const orderId = await makeOrder(client, phone);
        const prep = await prepareCoupon(client, { couponId: id, phone, subtotalCents: OMR(100) });
        assert.equal(prep.ok, true, phone);
        if (prep.ok) {
          const done = await commitRedemption(client, {
            coupon: prep.coupon, orderId, phoneHash: prep.phoneHash, discountCents: 1,
          });
          assert.equal(done.ok, true, phone);
        }
        await client.query("COMMIT");
      } finally {
        client.release();
      }
    }
    assert.equal(await redemptionCount(id), 2);
  });

  test("a race between two tabs of the same shopper is caught by the index", async () => {
    // Both transactions pass the "has this customer used it" check before either writes,
    // so only the unique index can stop the second one.
    const { id } = await makeCoupon("ONCERACE", { oncePerCustomer: true });
    const { rows } = await pool.query("SELECT id FROM coupons WHERE id = $1", [id]);
    assert.ok(rows[0]);
    const coupon = {
      id, code: "x", kind: "percent" as const, value: 10, minSubtotalCents: 0, maxDiscountCents: null,
      startsAt: null, endsAt: null, maxRedemptions: null, redemptions: 0, oncePerCustomer: true, active: true,
    };
    const hash = customerKey("95556666");

    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query("BEGIN");
      await b.query("BEGIN");
      const orderA = await makeOrder(a, "95556666");
      const resA = await commitRedemption(a, { coupon, orderId: orderA, phoneHash: hash, discountCents: 1 });
      assert.equal(resA.ok, true);
      await a.query("COMMIT");

      const orderB = await makeOrder(b, "95556666");
      const resB = await commitRedemption(b, { coupon, orderId: orderB, phoneHash: hash, discountCents: 1 });
      assert.equal(resB.ok, false, "the duplicate is refused by the database, not by a check");
      if (!resB.ok) assert.equal(resB.reason, "already-used");
      await b.query("ROLLBACK");
    } finally {
      a.release();
      b.release();
    }
  });

  test("a code without the rule stores no customer identifier at all", async () => {
    const { id } = await makeCoupon("NOTRACK");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderId = await makeOrder(client, "93334444");
      const prep = await prepareCoupon(client, { couponId: id, phone: "93334444", subtotalCents: OMR(100) });
      if (prep.ok) {
        await commitRedemption(client, { coupon: prep.coupon, orderId, phoneHash: prep.phoneHash, discountCents: 1 });
      }
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const { rows } = await pool.query("SELECT phone_hash FROM coupon_redemptions WHERE coupon_id = $1", [id]);
    assert.equal(rows[0].phone_hash, "", "no per-customer record is kept for a general code");
  });
});

describe("customerKey", () => {
  test("every way an Omani number is written gives one key", () => {
    const want = customerKey("91234567");
    for (const typed of ["9123 4567", "+968 9123 4567", "00968 91234567", "968-9123-4567", "+96891234567"]) {
      assert.equal(customerKey(typed), want, typed);
    }
  });

  test("different numbers give different keys", () => {
    assert.notEqual(customerKey("91234567"), customerKey("91234568"));
  });

  test("it is a hash, not the number", () => {
    const key = customerKey("91234567");
    assert.ok(!key.includes("91234567"));
    assert.match(key, /^[0-9a-f]{32}$/);
  });

  test("too short to be a phone number yields no key", () => {
    assert.equal(customerKey("123"), "");
    assert.equal(customerKey(""), "");
  });
});

describe("state changes between applying and paying", () => {
  test("a code switched off after it was applied is refused at checkout", async () => {
    const { id, code } = await makeCoupon("OFFLATER");
    assert.equal((await checkCoupon(code, OMR(100))).ok, true);

    await pool.query("UPDATE coupons SET active = false WHERE id = $1", [id]);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prep = await prepareCoupon(client, { couponId: id, phone: "91234567", subtotalCents: OMR(100) });
      assert.equal(prep.ok, false);
      if (!prep.ok) assert.equal(prep.reason, "inactive");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  test("a basket emptied below the minimum loses the code at checkout", async () => {
    const { id, code } = await makeCoupon("SHRINK", { minSubtotalCents: OMR(75) });
    assert.equal((await checkCoupon(code, OMR(100))).ok, true);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prep = await prepareCoupon(client, { couponId: id, phone: "91234567", subtotalCents: OMR(20) });
      assert.equal(prep.ok, false);
      if (!prep.ok) assert.equal(prep.reason, "below-minimum");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  test("a promotion that ended between the basket and the button is refused", async () => {
    const { id } = await makeCoupon("ENDED", { endsAt: new Date(Date.now() - 1000).toISOString() });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prep = await prepareCoupon(client, { couponId: id, phone: "91234567", subtotalCents: OMR(100) });
      assert.equal(prep.ok, false);
      if (!prep.ok) assert.equal(prep.reason, "expired");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
