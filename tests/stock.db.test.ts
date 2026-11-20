import "./helpers/env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { claimStock } from "../src/lib/stock";

/**
 * Stock claiming, against a real database.
 *
 * The interesting cases here are all about concurrency and about the nullable column:
 * that an untracked product is left alone, that a tracked one cannot be oversold, and
 * that two shoppers racing for the last piece cannot both get it. None of that can be
 * proved without a second connection and real row locks.
 *
 * Everything it creates is prefixed ZZTEST and deleted afterwards.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tag = `ZZTEST${Date.now().toString(36).toUpperCase()}`;
const productIds: number[] = [];

async function makeProduct(suffix: string, stockQty: number | null): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO products (slug, name, tagline, description, price_cents, stock_qty, in_stock, active, source)
     VALUES ($1, $2, '', '', 10000, $3, true, true, 'muscat') RETURNING id`,
    [`${tag}-${suffix}`.toLowerCase(), `${tag} ${suffix}`, stockQty],
  );
  productIds.push(rows[0].id);
  return rows[0].id;
}

const stockOf = async (id: number) => {
  const { rows } = await pool.query(`SELECT stock_qty AS q, in_stock AS "in" FROM products WHERE id = $1`, [id]);
  return rows[0] as { q: number | null; in: boolean };
};

/** Run claimStock inside its own transaction, as the checkout does. */
async function claimIn(lines: { productId: number; quantity: number; name: string }[], commit = true) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await claimStock(c, lines);
    await c.query(r.ok && commit ? "COMMIT" : "ROLLBACK");
    return r;
  } finally {
    c.release();
  }
}

before(async () => {
  await pool.query("SELECT 1");
});

after(async () => {
  if (productIds.length) {
    await pool.query(`DELETE FROM products WHERE id = ANY($1::int[])`, [productIds]);
  }
  await pool.end();
});

describe("claimStock", () => {
  test("an untracked product (stock_qty NULL) is left exactly as it was", async () => {
    const id = await makeProduct("untracked", null);
    const r = await claimIn([{ productId: id, quantity: 5, name: "Untracked" }]);
    assert.equal(r.ok, true);
    const s = await stockOf(id);
    assert.equal(s.q, null, "an untracked product must stay untracked");
    assert.equal(s.in, true, "and must not be taken off sale");
  });

  test("a tracked product comes down by the quantity ordered", async () => {
    const id = await makeProduct("tracked", 10);
    assert.equal((await claimIn([{ productId: id, quantity: 3, name: "Tracked" }])).ok, true);
    assert.equal((await stockOf(id)).q, 7);
    assert.equal((await stockOf(id)).in, true);
  });

  test("taking the last one marks it out of stock", async () => {
    const id = await makeProduct("last", 2);
    assert.equal((await claimIn([{ productId: id, quantity: 2, name: "Last" }])).ok, true);
    const s = await stockOf(id);
    assert.equal(s.q, 0);
    assert.equal(s.in, false, "the storefront must stop offering it");
  });

  test("ordering more than exists is refused, and nothing is taken", async () => {
    const id = await makeProduct("short", 2);
    const r = await claimIn([{ productId: id, quantity: 3, name: "Short Sofa" }]);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.left, 2, "the refusal says how many are actually left");
      assert.equal(r.name, "Short Sofa");
    }
    assert.equal((await stockOf(id)).q, 2, "a refused claim must not take any");
  });

  test("the same product on two basket lines comes off one shelf", async () => {
    // Two fabrics of the same sofa: 2 + 2 must be checked against stock as 4, not 2.
    const id = await makeProduct("twolines", 3);
    const r = await claimIn([
      { productId: id, quantity: 2, name: "Two Lines" },
      { productId: id, quantity: 2, name: "Two Lines" },
    ]);
    assert.equal(r.ok, false, "4 wanted from a shelf of 3 must be refused");
    assert.equal((await stockOf(id)).q, 3);
  });

  test("a rolled-back checkout leaves the stock untouched", async () => {
    const id = await makeProduct("rollback", 5);
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      assert.equal((await claimStock(c, [{ productId: id, quantity: 5, name: "Rollback" }])).ok, true);
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
    assert.equal((await stockOf(id)).q, 5, "an abandoned order must not consume stock");
  });

  test("two shoppers racing for the last piece: exactly one wins", async () => {
    const id = await makeProduct("race", 1);
    const a: PoolClient = await pool.connect();
    const b: PoolClient = await pool.connect();
    try {
      await a.query("BEGIN");
      await b.query("BEGIN");

      const first = await claimStock(a, [{ productId: id, quantity: 1, name: "Race" }]);
      assert.equal(first.ok, true);

      // B now blocks on A's row lock; it can only resolve once A commits.
      const second = claimStock(b, [{ productId: id, quantity: 1, name: "Race" }]);
      await a.query("COMMIT");
      const loser = await second;

      assert.equal(loser.ok, false, "the second shopper must be refused, not oversold");
      if (!loser.ok) assert.equal(loser.left, 0);
      await b.query("ROLLBACK");
    } finally {
      a.release();
      b.release();
    }
    assert.equal((await stockOf(id)).q, 0, "exactly one piece left the shelf");
  });
});
