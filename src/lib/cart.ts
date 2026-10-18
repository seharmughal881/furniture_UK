import "server-only";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { pool } from "./db";
import type { Cart } from "./types";
import { isUuid } from "./validation";

const COOKIE = "atelier_cart";

/** The cart id from the cookie, if it points at a real cart. */
export async function currentCartId(): Promise<string | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !isUuid(id)) return null;
  const { rows } = await pool.query("SELECT id FROM carts WHERE id = $1", [id]);
  return rows[0]?.id ?? null;
}

/** The current cart id, creating a cart (and cookie) when there is none. */
export async function ensureCartId(): Promise<string> {
  const existing = await currentCartId();
  if (existing) return existing;
  const { rows } = await pool.query("INSERT INTO carts DEFAULT VALUES RETURNING id");
  (await cookies()).set(COOKIE, rows[0].id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return rows[0].id;
}

export async function clearCartCookie() {
  (await cookies()).delete(COOKIE);
}

/** Cart contents with prices always taken from the products table. */
export async function readCart(cartId: string | null, db: PoolClient | typeof pool = pool): Promise<Cart> {
  if (!cartId) return { lines: [], count: 0, subtotalCents: 0 };
  const { rows } = await db.query(
    `SELECT ci.id, p.id AS "productId", p.slug, p.name, p.kind, p.price_cents AS "unitPriceCents",
            p.lead_time_weeks AS "leadTimeWeeks", ci.quantity,
            json_build_object('fabric', ci.fabric, 'wood', ci.wood, 'metal', ci.metal) AS config
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1 ORDER BY ci.id`,
    [cartId],
  );
  return {
    lines: rows,
    count: rows.reduce((n, r) => n + r.quantity, 0),
    subtotalCents: rows.reduce((n, r) => n + r.quantity * r.unitPriceCents, 0),
  };
}
