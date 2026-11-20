import "server-only";
import type { PoolClient } from "pg";

/**
 * Taking stock off the shelf when an order is placed.
 *
 * products.stock_qty is nullable and that nullability is the feature: NULL means "not
 * counted", which is how all 665 products start and how most made-to-order furniture
 * should stay. Only a product the owner has put a number against is claimed here, so
 * turning this on is opt-in per product and the rest of the catalogue is untouched.
 *
 * Where a number *is* set it has to mean something, so an order for more than exists is
 * refused rather than quietly shipped short. That matches how the coupon path behaves a
 * few lines earlier in the checkout: the deal the shopper was shown either holds or they
 * are told, never silently changed.
 *
 * Rows are claimed in product-id order. Two shoppers checking out with the same two
 * products in opposite basket orders would otherwise be able to take one lock each and
 * wait on the other for ever; a fixed order makes that deadlock impossible.
 */

export type StockLine = { productId: number; quantity: number; name: string };

export type StockResult = { ok: true } | { ok: false; name: string; left: number };

export async function claimStock(client: PoolClient, lines: StockLine[]): Promise<StockResult> {
  // One row per product: the same product can appear on several basket lines (different
  // fabric, different variant) and all of them come off the same shelf.
  const wanted = new Map<number, { quantity: number; name: string }>();
  for (const l of lines) {
    const prev = wanted.get(l.productId);
    if (prev) prev.quantity += l.quantity;
    else wanted.set(l.productId, { quantity: l.quantity, name: l.name });
  }

  for (const [productId, { quantity, name }] of [...wanted].sort((a, b) => a[0] - b[0])) {
    /*
     * The conditional UPDATE is the whole guard: it only matches while enough is left, and
     * because the row is locked for the rest of the transaction a second checkout cannot
     * read the same number and spend it twice. No SELECT-then-UPDATE race exists because
     * there is no SELECT.
     *
     * in_stock is derived in the same statement, so the storefront stops offering a piece
     * the moment the last one is claimed rather than on the next admin edit.
     */
    const { rowCount } = await client.query(
      `UPDATE products
          SET stock_qty = stock_qty - $2,
              in_stock  = (stock_qty - $2) > 0
        WHERE id = $1 AND stock_qty IS NOT NULL AND stock_qty >= $2`,
      [productId, quantity],
    );

    if (rowCount === 0) {
      // Either the product is untracked (fine, nothing to claim) or there is not enough
      // left. One more read tells the two apart, and it is cheap because it only happens
      // on the failing path.
      const { rows } = await client.query(
        `SELECT stock_qty AS "stockQty" FROM products WHERE id = $1 FOR UPDATE`,
        [productId],
      );
      const left: number | null = rows[0]?.stockQty ?? null;
      if (left === null) continue; // not counted: nothing to take
      return { ok: false, name, left };
    }
  }

  return { ok: true };
}
