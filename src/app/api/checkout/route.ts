import { headers } from "next/headers";
import { clearCartCookie, currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { deliveryFee, vatIncluded } from "@/lib/types";
import { badRequest, checkoutSchema } from "@/lib/validation";

/**
 * Generous on purpose: a real customer may legitimately retry a few times, and every
 * order here is cash on delivery, so this limit exists to stop a script filling the
 * order queue with junk -- not to police shoppers.
 */
const ORDERS_PER_HOUR = 10;
const HOUR_SECONDS = 60 * 60;

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  const quota = await hit(bucketFor("checkout", callerIp(await headers())), ORDERS_PER_HOUR, HOUR_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Several orders have already been placed from this connection. Please call us to continue." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

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
    // After COMMIT: the order exists either way, so a failure to clear the cookie must not
    // turn a placed order into a 500 that invites the customer to order again.
    await clearCartCookie().catch(() => {});
    return Response.json({ order }, { status: 201 });
  } catch (err) {
    // Guarded like updateProduct(): on a dead connection ROLLBACK throws too, and an
    // unguarded await here would replace the real error with that one.
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
