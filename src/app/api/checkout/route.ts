import { clearCartCookie, currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { deliveryFee, vatIncluded } from "@/lib/types";
import { badRequest, checkoutSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your basket is empty" }, { status: 400 });

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // lock the cart so a double-submit can't create two orders
    await client.query("SELECT id FROM carts WHERE id = $1 FOR UPDATE", [cartId]);
    const cart = await readCart(cartId, client);
    if (cart.lines.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Your basket is empty" }, { status: 400 });
    }
    // Free over OMR 75; otherwise the team confirms the fee by phone before dispatch.
    const fee = deliveryFee(cart.subtotalCents);
    const total = cart.subtotalCents + (fee ?? 0);
    const { rows } = await client.query(
      `INSERT INTO orders (email, name, phone, address, address2, city, county, postcode, country, landmark,
                           shipping_method, payment_method, delivery_fee_tbc,
                           subtotal_cents, shipping_cents, total_cents, vat_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'','Oman',$8,'home-delivery',$9,$10,$11,$12,$13,$14) RETURNING id, number`,
      [d.email, d.name, d.phone, d.area, d.building, d.wilaya, d.governorate, d.landmark, d.paymentMethod,
       fee === null, cart.subtotalCents, fee ?? 0, total, vatIncluded(total)],
    );
    const order = rows[0];
    for (const l of cart.lines as (typeof cart.lines[number] & { productId: number })[]) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, config, unit_price_cents, quantity)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
        [order.id, l.productId, l.name, JSON.stringify({ ...l.config, variant: l.variant }), l.unitPriceCents, l.quantity],
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
