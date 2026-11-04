import "server-only";
import { pool } from "../db";
import { isUuid } from "../validation";
import { requireAdmin } from "./session";
import { canTransition, isOrderStatus, type OrderStatus } from "./status";

/**
 * Every admin read and write of orders goes through this module, and **every exported
 * function calls requireAdmin() before it touches the pool**.
 *
 * The guard deliberately lives with the data rather than on the route. A Next layout is
 * cached and does not rerender between navigations, so a layout check is not a security
 * boundary; and proxy.ts only checks that a cookie exists, which proves nothing. Putting
 * the check here means a new admin page that forgets to guard itself still cannot read
 * a single order.
 */

const PAGE_SIZE = 25;

export type OrderListItem = {
  id: string;
  number: number;
  name: string;
  phone: string;
  city: string;
  county: string;
  status: OrderStatus;
  totalCents: number;
  feeTbc: boolean;
  itemCount: number;
  /** Already formatted in Oman time by Postgres — see the note in listOrders. */
  placedAt: string;
  /** Still waiting for its confirmation call more than a day after being placed. */
  overdue: boolean;
};

export type OrderListFilters = {
  status?: string;
  governorate?: string;
  search?: string;
  page?: number;
};

export type OrderList = {
  rows: OrderListItem[];
  total: number;
  page: number;
  pages: number;
};

/**
 * Work out what the staff member meant by typing into the one search box, so they never
 * have to pick a mode. Phone numbers are matched on their last 8 digits (the Omani
 * subscriber number) because validation.ts accepts several formats and stores them
 * verbatim -- real rows hold both "9123 4567" and "+968...". That also matches the
 * orders_phone_digits_idx functional index, so it stays indexed rather than scanning.
 */
function interpretSearch(search: string | null) {
  if (!search) return { name: null, phoneDigits: null, number: null };
  const digits = search.replace(/\D/g, "");
  if (search.startsWith("#")) {
    const n = Number(digits);
    return { name: null, phoneDigits: null, number: Number.isSafeInteger(n) && n > 0 ? n : null };
  }
  if (digits.length >= 6) return { name: null, phoneDigits: digits.slice(-8), number: null };
  if (digits.length > 0 && digits === search.trim()) {
    const n = Number(digits);
    return { name: null, phoneDigits: null, number: Number.isSafeInteger(n) && n > 0 ? n : null };
  }
  return { name: search, phoneDigits: null, number: null };
}

/** One page of orders, newest first. Single round trip: the total comes back as a window count. */
export async function listOrders(filters: OrderListFilters): Promise<OrderList> {
  await requireAdmin();

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const status = filters.status && isOrderStatus(filters.status) ? filters.status : null;
  const governorate = filters.governorate?.trim() || null;
  const search = filters.search?.trim() || null;
  const { name, phoneDigits, number } = interpretSearch(search);

  // Dates are formatted by Postgres in Asia/Muscat rather than with JS Date in the
  // component: created_at is TIMESTAMPTZ and Oman is UTC+4 with no DST, so formatting on
  // the server's clock would show the wrong time. It also keeps these Server Components
  // free of the synchronous clock reads that Cache Components rejects while prerendering.
  const { rows } = await pool.query(
    `SELECT o.id, o.number, o.name, o.phone, o.city, o.county, o.status,
            o.total_cents AS "totalCents", o.delivery_fee_tbc AS "feeTbc",
            to_char(o.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "placedAt",
            (o.status IN ('placed') AND o.created_at < now() - interval '1 day') AS overdue,
            (SELECT count(*)::int FROM order_items i WHERE i.order_id = o.id) AS "itemCount",
            count(*) OVER ()::int AS "totalRows"
     FROM orders o
     WHERE ($1::text IS NULL OR o.status = $1)
       AND ($2::text IS NULL OR o.county = $2)
       AND ($3::text IS NULL OR lower(o.name) LIKE lower($3) || '%')
       AND ($4::text IS NULL OR right(regexp_replace(o.phone, '\\D', '', 'g'), 8) = $4)
       AND ($5::int  IS NULL OR o.number = $5)
     ORDER BY o.created_at DESC
     LIMIT $6 OFFSET $7`,
    [status, governorate, name, phoneDigits, number, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  const total = rows[0]?.totalRows ?? 0;
  return {
    // Map explicitly so the window-function count does not leak into the returned rows.
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      phone: r.phone,
      city: r.city,
      county: r.county,
      status: r.status,
      totalCents: r.totalCents,
      feeTbc: r.feeTbc,
      itemCount: r.itemCount,
      placedAt: r.placedAt,
      overdue: r.overdue,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type OrderLine = { name: string; qty: number; price: number; config: Record<string, string> };
export type OrderEvent = {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string;
  by: string | null;
  createdAt: string;
};
export type OrderDetail = {
  id: string;
  number: number;
  status: OrderStatus;
  name: string;
  phone: string;
  email: string;
  address: string;
  address2: string;
  city: string;
  county: string;
  landmark: string;
  paymentMethod: string;
  feeTbc: boolean;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  vatCents: number;
  createdAt: string;
  items: OrderLine[];
  events: OrderEvent[];
};

/** One order with its lines and its full audit history, or null. */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  await requireAdmin();
  if (!isUuid(id)) return null;

  const { rows } = await pool.query(
    `SELECT o.id, o.number, o.status, o.name, o.phone, o.email,
            o.address, o.address2, o.city, o.county, o.landmark,
            o.payment_method AS "paymentMethod", o.delivery_fee_tbc AS "feeTbc",
            o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents",
            o.total_cents AS "totalCents", o.vat_cents AS "vatCents",
            to_char(o.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "createdAt",
            COALESCE((SELECT json_agg(json_build_object(
                        'name', i.product_name, 'qty', i.quantity,
                        'price', i.unit_price_cents, 'config', i.config) ORDER BY i.id)
                      FROM order_items i WHERE i.order_id = o.id), '[]'::json) AS items,
            COALESCE((SELECT json_agg(json_build_object(
                        'id', e.id, 'fromStatus', e.from_status, 'toStatus', e.to_status,
                        'note', e.note,
                        -- the name recorded at the time wins over the current account name,
                        -- and survives the account being deleted
                        'by', COALESCE(NULLIF(e.actor_name, ''), u.name),
                        'createdAt', to_char(e.created_at AT TIME ZONE 'Asia/Muscat',
                                             'DD Mon YYYY, HH24:MI'))
                        ORDER BY e.created_at DESC, e.id DESC)
                      FROM order_events e
                      LEFT JOIN admin_users u ON u.id = e.admin_user_id
                      WHERE e.order_id = o.id), '[]'::json) AS events
     FROM orders o WHERE o.id = $1`,
    [id],
  );
  return (rows[0] as OrderDetail | undefined) ?? null;
}

export type StatusChangeResult = { ok: true } | { ok: false; error: string };

/**
 * Move an order to a new status, recording who did it.
 *
 * The legal-transition check happens here, inside the transaction and against the status
 * read under a row lock — not in the UI. Hiding a button is not enforcement.
 */
export async function setOrderStatus(
  orderId: string,
  to: OrderStatus,
  note = "",
): Promise<StatusChangeResult> {
  const admin = await requireAdmin();
  if (!isUuid(orderId)) return { ok: false, error: "Unknown order." };
  if (!isOrderStatus(to)) return { ok: false, error: "Unknown status." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    const current = rows[0]?.status as OrderStatus | undefined;
    if (!current) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Unknown order." };
    }
    if (current === to) {
      await client.query("ROLLBACK");
      return { ok: false, error: `This order is already ${to}.` };
    }
    if (!canTransition(current, to)) {
      await client.query("ROLLBACK");
      return { ok: false, error: `An order that is ${current} cannot be marked ${to}.` };
    }

    await client.query(`UPDATE orders SET status = $2, updated_at = now() WHERE id = $1`, [orderId, to]);
    await client.query(
      `INSERT INTO order_events (order_id, admin_user_id, actor_name, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, admin.id, admin.name, current, to, note.slice(0, 2000)],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Add an internal note without changing the status. */
export async function addOrderNote(orderId: string, note: string): Promise<StatusChangeResult> {
  const admin = await requireAdmin();
  if (!isUuid(orderId)) return { ok: false, error: "Unknown order." };
  const text = note.trim();
  if (!text) return { ok: false, error: "Write a note first." };

  const { rowCount } = await pool.query(
    `INSERT INTO order_events (order_id, admin_user_id, actor_name, from_status, to_status, note)
     SELECT o.id, $2, $3, o.status, o.status, $4 FROM orders o WHERE o.id = $1`,
    [orderId, admin.id, admin.name, text.slice(0, 2000)],
  );
  return rowCount ? { ok: true } : { ok: false, error: "Unknown order." };
}

/** Counts per status, for the filter chips above the list. */
export async function statusCounts(): Promise<Record<string, number>> {
  await requireAdmin();
  const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM orders GROUP BY status`);
  return Object.fromEntries(rows.map((r) => [r.status as string, r.n as number]));
}
