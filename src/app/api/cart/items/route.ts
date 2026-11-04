import { ensureCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { addToCartSchema, badRequest } from "@/lib/validation";

/**
 * A basket holds at most this many distinct lines. Quantity per line is already capped at
 * 20 by the schema, but nothing limited the number of *lines*: repeating this request
 * with different variant/material combinations grew one basket without bound, and
 * readCart() joins every line on every basket read.
 */
const MAX_CART_LINES = 40;

export async function POST(request: Request) {
  const parsed = addToCartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  // Only accept material slugs that exist for their role (empty = not applicable).
  const { rows: mats } = await pool.query("SELECT slug, role FROM materials");
  const valid = (slug: string, role: string) => slug === "" || mats.some((m) => m.slug === slug && m.role === role);
  for (const it of parsed.data.items) {
    if (!valid(it.config.fabric, "fabric") || !valid(it.config.wood, "wood") || !valid(it.config.metal, "metal")) {
      return Response.json({ error: "Unknown material" }, { status: 400 });
    }
  }

  const cartId = await ensureCartId();

  // Checked before inserting rather than inside the statement, so a full basket gets a
  // clear message instead of looking like an unknown product. The count is approximate
  // (some of these items may merge into lines that already exist) which is fine: it only
  // ever refuses earlier than strictly necessary, never later.
  const { rows: lineCount } = await pool.query(
    `SELECT count(*)::int AS n FROM cart_items WHERE cart_id = $1`,
    [cartId],
  );
  if (lineCount[0].n + parsed.data.items.length > MAX_CART_LINES) {
    return Response.json(
      { error: "Your basket is full. Please check out or remove something first." },
      { status: 409 },
    );
  }

  for (const it of parsed.data.items) {
    // the variant must be one the product actually has ("" = the product's only option)
    const res = await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, variant, fabric, wood, metal, quantity)
       SELECT $1, id, $7, $3, $4, $5, $6 FROM products
       WHERE slug = $2 AND active
         AND ($7 = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements(variants) v WHERE v->>'title' = $7))
       ON CONFLICT (cart_id, product_id, variant, fabric, wood, metal)
       DO UPDATE SET quantity = LEAST(20, cart_items.quantity + EXCLUDED.quantity)`,
      [cartId, it.productSlug, it.config.fabric, it.config.wood, it.config.metal, it.quantity, it.variant],
    );
    if (res.rowCount === 0) return Response.json({ error: `Unknown product ${it.productSlug}` }, { status: 404 });
  }
  await pool.query("UPDATE carts SET updated_at = now() WHERE id = $1", [cartId]);
  return Response.json(await readCart(cartId), { status: 201 });
}
