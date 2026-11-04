import "server-only";
import { pool } from "../db";
import { requireAdmin } from "./session";

/**
 * Customers, derived from orders rather than stored separately.
 *
 * There is no customers table and this does not add one: checkout is guest-only with no
 * accounts, so a "customer" is simply everyone who has ordered. Inventing a table would
 * mean keeping it in step with every order write for no gain.
 *
 * They are grouped by the last 8 digits of the phone number -- the Omani subscriber
 * number -- because phones are stored exactly as typed and the same person appears as
 * "9123 4567", "+968 9123 4567" and "96891234567". That expression matches the
 * orders_phone_digits_idx functional index added in v7, so grouping stays indexed.
 */

const PAGE_SIZE = 30;
const PHONE_KEY = `right(regexp_replace(o.phone, '\\D', '', 'g'), 8)`;

export type Customer = {
  phoneKey: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  county: string;
  orders: number;
  /** Cash actually taken: delivered orders only, matching the dashboard's definition. */
  spentCents: number;
  /** Committed but not yet collected. */
  openCents: number;
  firstOrder: string;
  lastOrder: string;
  cancelled: number;
};

export type CustomerList = { rows: Customer[]; total: number; page: number; pages: number };

export async function listCustomers(search: string | null, page = 1): Promise<CustomerList> {
  await requireAdmin();
  const current = Math.max(1, Math.floor(page));
  const term = search?.trim() || null;
  const digits = term ? term.replace(/\D/g, "") : "";

  const { rows } = await pool.query(
    `SELECT ${PHONE_KEY} AS "phoneKey",
            -- the most recent spelling of their name and address wins
            (array_agg(o.name  ORDER BY o.created_at DESC))[1] AS name,
            (array_agg(o.phone ORDER BY o.created_at DESC))[1] AS phone,
            (array_agg(o.email ORDER BY o.created_at DESC))[1] AS email,
            (array_agg(o.city  ORDER BY o.created_at DESC))[1] AS city,
            (array_agg(o.county ORDER BY o.created_at DESC))[1] AS county,
            count(*)::int AS orders,
            count(*) FILTER (WHERE o.status IN ('cancelled','returned'))::int AS cancelled,
            COALESCE(sum(o.total_cents) FILTER (WHERE o.status = 'delivered'), 0)::bigint AS "spentCents",
            COALESCE(sum(o.total_cents) FILTER (WHERE o.status IN ('placed','confirmed','dispatched')), 0)::bigint AS "openCents",
            to_char(min(o.created_at) AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY') AS "firstOrder",
            to_char(max(o.created_at) AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY') AS "lastOrder",
            count(*) OVER ()::int AS "totalRows"
     FROM orders o
     WHERE ($1::text IS NULL
            OR lower(o.name) LIKE '%' || lower($1) || '%'
            OR ($2::text <> '' AND right(regexp_replace(o.phone, '\\D', '', 'g'), 8) LIKE '%' || $2 || '%'))
     GROUP BY ${PHONE_KEY}
     ORDER BY max(o.created_at) DESC
     LIMIT $3 OFFSET $4`,
    [term, digits, PAGE_SIZE, (current - 1) * PAGE_SIZE],
  );

  const total = rows[0]?.totalRows ?? 0;
  return {
    rows: rows.map((r) => ({
      phoneKey: r.phoneKey,
      name: r.name,
      phone: r.phone,
      email: r.email,
      city: r.city,
      county: r.county,
      orders: r.orders,
      cancelled: r.cancelled,
      // bigint arrives as a string from node-postgres.
      spentCents: Number(r.spentCents),
      openCents: Number(r.openCents),
      firstOrder: r.firstOrder,
      lastOrder: r.lastOrder,
    })),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type CustomerOrder = {
  id: string;
  number: number;
  status: string;
  totalCents: number;
  placedAt: string;
};

/** Every order belonging to one customer, newest first. */
export async function customerOrders(phoneKey: string): Promise<CustomerOrder[]> {
  await requireAdmin();
  if (!/^\d{1,8}$/.test(phoneKey)) return [];

  const { rows } = await pool.query(
    `SELECT o.id, o.number, o.status, o.total_cents AS "totalCents",
            to_char(o.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "placedAt"
     FROM orders o
     WHERE ${PHONE_KEY} = $1
     ORDER BY o.created_at DESC`,
    [phoneKey],
  );
  return rows as CustomerOrder[];
}
