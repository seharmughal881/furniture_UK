import { ensureCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { addToCartSchema, badRequest } from "@/lib/validation";

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
