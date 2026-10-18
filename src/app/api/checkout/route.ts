import { clearCartCookie, currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { shippingCost, vatIncluded } from "@/lib/types";
import { badRequest, checkoutSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your cart is empty" }, { status: 400 });

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // lock the cart so a double-submit can't create two orders
    await client.query("SELECT id FROM carts WHERE id = $1 FOR UPDATE", [cartId]);
    const cart = await readCart(cartId, client);
    if (cart.lines.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Your cart is empty" }, { status: 400 });
    }
    const shipping = shippingCost(d.shippingMethod, cart.subtotalCents);
    const { rows } = await client.query(
      `INSERT INTO orders (email, name, phone, address, address2, city, county, postcode, country, shipping_method,
                           subtotal_cents, shipping_cents, total_cents, vat_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, number`,
      [d.email, d.name, d.phone, d.address, d.address2, d.city, d.county, d.postcode, d.country, d.shippingMethod,
       cart.subtotalCents, shipping, cart.subtotalCents + shipping, vatIncluded(cart.subtotalCents + shipping)],
    );
    const order = rows[0];
    for (const l of cart.lines as (typeof cart.lines[number] & { productId: number })[]) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, config, unit_price_cents, quantity)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
        [order.id, l.productId, l.name, JSON.stringify(l.config), l.unitPriceCents, l.quantity],
      );
    }
    await client.query("DELETE FROM carts WHERE id = $1", [cartId]);
    await client.query("COMMIT");
    await clearCartCookie();
    return Response.json({ order }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
