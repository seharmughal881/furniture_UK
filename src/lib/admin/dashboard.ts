import "server-only";
import { pool } from "../db";
import { requireAdmin } from "./session";
import type { OrderStatus } from "./status";

/**
 * The figures behind /admin.
 *
 * Like orders.ts, **every exported function calls requireAdmin() before it touches the
 * pool**, so a page that forgets to guard itself still reads nothing. See the longer note
 * at the top of orders.ts for why the guard lives with the data rather than on the route.
 *
 * Every number here is read from the live tables -- there is no seeded or placeholder
 * figure anywhere in this file.
 *
 * Two conventions carried over from orders.ts:
 *   - money is in baisa (integer minor units; 1 OMR = 1000), exactly as orders stores it;
 *   - dates are formatted by Postgres in Asia/Muscat, because created_at is TIMESTAMPTZ
 *     and formatting on the server's own clock would show the wrong time. It also keeps
 *     these Server Components free of the synchronous clock reads that Cache Components
 *     rejects while prerendering.
 */

/** Orders that still need someone to do something. Cancelled and returned are finished. */
const OPEN_STATUSES = "('placed', 'confirmed', 'dispatched')";

/** The last 8 digits of a phone number: the Omani subscriber number. */
const PHONE_DIGITS = `right(regexp_replace(phone, '\\D', '', 'g'), 8)`;

export type Totals = {
  products: number;
  outOfStock: number;
  orders: number;
  ordersToday: number;
  /** Placed, but nobody has made the confirmation call yet. */
  awaitingCall: number;
  openOrders: number;
  /** Distinct customers, counted by phone number rather than by order. */
  customers: number;
  /** Cash actually taken: delivered orders only. */
  collectedCents: number;
  /** Still owed on orders that are open -- not yet revenue. */
  inProgressCents: number;
  /** Submitted reviews waiting for a human; they are invisible on the site until then. */
  pendingReviews: number;
  /** Quote requests nobody has picked up yet. */
  newInquiries: number;
};

export async function getTotals(): Promise<Totals> {
  await requireAdmin();

  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM products WHERE active)                         AS products,
       (SELECT count(*)::int FROM products WHERE active AND NOT in_stock)        AS "outOfStock",
       (SELECT count(*)::int FROM orders)                                        AS orders,
       -- "today" means today in Oman. date_trunc gives a local timestamp, so it is cast
       -- back to timestamptz in the same zone; comparing against the server's zone here
       -- would move the boundary by hours.
       (SELECT count(*)::int FROM orders
         WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Muscat')
                              AT TIME ZONE 'Asia/Muscat'))                       AS "ordersToday",
       (SELECT count(*)::int FROM orders WHERE status = 'placed')                AS "awaitingCall",
       (SELECT count(*)::int FROM orders WHERE status IN ${OPEN_STATUSES})       AS "openOrders",
       (SELECT count(DISTINCT ${PHONE_DIGITS})::int FROM orders)                 AS customers,
       (SELECT COALESCE(sum(total_cents), 0)::bigint FROM orders
         WHERE status = 'delivered')                                             AS "collectedCents",
       (SELECT COALESCE(sum(total_cents), 0)::bigint FROM orders
         WHERE status IN ${OPEN_STATUSES})                                       AS "inProgressCents",
       (SELECT count(*)::int FROM reviews   WHERE status = 'pending')            AS "pendingReviews",
       (SELECT count(*)::int FROM inquiries WHERE status = 'new')                AS "newInquiries"`,
  );

  const r = rows[0];
  return {
    products: r.products,
    outOfStock: r.outOfStock,
    orders: r.orders,
    ordersToday: r.ordersToday,
    awaitingCall: r.awaitingCall,
    openOrders: r.openOrders,
    customers: r.customers,
    // node-postgres hands back bigint as a string (it cannot fit every int8 in a JS
    // number), so these two are converted explicitly rather than left as "0".
    collectedCents: Number(r.collectedCents),
    inProgressCents: Number(r.inProgressCents),
    pendingReviews: r.pendingReviews,
    newInquiries: r.newInquiries,
  };
}

export type RecentOrder = {
  id: string;
  number: number;
  name: string;
  city: string;
  status: OrderStatus;
  totalCents: number;
  placedAt: string;
};

export async function getRecentOrders(count = 8): Promise<RecentOrder[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT o.id, o.number, o.name, o.city, o.status, o.total_cents AS "totalCents",
            to_char(o.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon, HH24:MI') AS "placedAt"
     FROM orders o
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [count],
  );
  return rows as RecentOrder[];
}

export type BestSeller = {
  slug: string;
  name: string;
  image: string | null;
  units: number;
  orders: number;
  revenueCents: number;
};

/**
 * Ranked by units actually sold. Cancelled and returned orders are excluded, so a product
 * that was ordered and sent back does not count as a best seller.
 *
 * Quantity and price come from order_items, which copies both at purchase time, so this
 * stays correct after the catalogue is repriced.
 */
export async function getBestSellers(count = 8): Promise<BestSeller[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT p.slug, p.name, p.images[1] AS image,
            sum(i.quantity)::int AS units,
            count(DISTINCT i.order_id)::int AS orders,
            sum(i.quantity * i.unit_price_cents)::bigint AS "revenueCents"
     FROM order_items i
     JOIN orders o   ON o.id = i.order_id
     JOIN products p ON p.id = i.product_id
     WHERE o.status NOT IN ('cancelled', 'returned')
     -- grouping by the primary key lets the other products columns be selected directly
     GROUP BY p.id
     ORDER BY units DESC, "revenueCents" DESC
     LIMIT $1`,
    [count],
  );
  return rows.map((r) => ({ ...r, revenueCents: Number(r.revenueCents) })) as BestSeller[];
}

export type StockItem = {
  slug: string;
  name: string;
  category: string;
  image: string | null;
  priceCents: number;
};

/**
 * Products the shop cannot currently sell.
 *
 * NOTE: products.in_stock is a BOOLEAN -- the schema holds no stock *quantity*, so a
 * "low stock" threshold cannot be computed from the data that exists today. This returns
 * what is genuinely knowable: the products that are flagged out of stock. Once product
 * management adds a numeric stock level this becomes a true low-stock list.
 */
export async function getOutOfStock(count = 8): Promise<StockItem[]> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT slug, name, category, images[1] AS image, price_cents AS "priceCents"
     FROM products
     WHERE active AND NOT in_stock
     ORDER BY sort_order, id
     LIMIT $1`,
    [count],
  );
  return rows as StockItem[];
}
