import { headers } from "next/headers";
import { clearCartCookie, currentCartId, readCart } from "@/lib/cart";
import { commitRedemption, prepareCoupon } from "@/lib/coupons";
import { pool } from "@/lib/db";
import { orderTotals, refusalMessage } from "@/lib/pricing";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { NATIONWIDE, quoteShipping } from "@/lib/shipping";
import { getZone } from "@/lib/shipping-data";
import { claimStock } from "@/lib/stock";
import { formatPrice, vatIncluded } from "@/lib/types";
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

    /*
     * Delivery is priced from the governorate on THIS form, not from whatever the shopper
     * picked in the basket's estimator. The estimator is a preview and its governorate is
     * only a hint; the address being delivered to is the one that decides the fee, and a
     * shopper who estimated for Muscat and then typed a Musandam address must be charged
     * for Musandam.
     *
     * A governorate with no zone row falls back to the nationwide terms, so a renamed or
     * deleted zone cannot take the checkout down.
     */
    const zone = (await getZone(d.governorate, client)) ?? NATIONWIDE;

    /*
     * The coupon, re-validated from the locked row.
     *
     * Everything the basket said about the discount is discarded here and recomputed:
     * between applying the code and pressing Place order the promotion can have ended,
     * been switched off, or run out, and the basket can have shrunk below the minimum.
     *
     * A coupon that no longer applies fails the checkout rather than being dropped
     * silently. Dropping it would charge more than the page displayed, which is the one
     * outcome a shopper must never meet -- so they get told, the basket comes back
     * without the code, and they decide.
     */
    let discountCents = 0;
    let freeShipping = false;
    let couponCode = "";
    let prepared: Awaited<ReturnType<typeof prepareCoupon>> | null = null;

    const { rows: cartRow } = await client.query("SELECT coupon_id FROM carts WHERE id = $1", [cartId]);
    const couponId: number | null = cartRow[0]?.coupon_id ?? null;

    if (couponId !== null) {
      prepared = await prepareCoupon(client, {
        couponId,
        phone: d.phone,
        subtotalCents: cart.subtotalCents,
      });
      if (!prepared.ok) {
        await client.query("ROLLBACK");
        // Detach the dead code so the basket they are sent back to is the one they will
        // actually be charged for. Outside the rolled-back transaction, on the pool.
        await pool.query("UPDATE carts SET coupon_id = NULL WHERE id = $1", [cartId]).catch(() => {});
        return Response.json(
          {
            error: refusalMessage(prepared.reason, formatPrice, prepared.shortfallCents),
            couponRejected: true,
          },
          { status: 409 },
        );
      }
      discountCents = prepared.discountCents;
      freeShipping = prepared.freeShipping;
      couponCode = prepared.coupon.code;
    }

    const quote = quoteShipping(zone, cart.subtotalCents, { freeShippingCoupon: freeShipping });

    // A governorate the owner has switched off is refused outright rather than taken as
    // an order with an unknown delivery fee. Accepting it would put a commitment in the
    // order queue that the business has said it cannot meet.
    if (quote && !quote.available) {
      await client.query("ROLLBACK");
      return Response.json(
        { error: `We don't deliver to ${d.governorate} yet. Please call us and we'll arrange it.` },
        { status: 422 },
      );
    }

    const fee = quote?.feeCents ?? null;
    const totals = orderTotals({ subtotalCents: cart.subtotalCents, discountCents, shippingCents: fee });

    // A note typed on the checkout page wins over one left in the basket; when the form
    // sends none at all the basket's note stands.
    const note = d.note ?? cart.note;

    /*
     * Take the stock before the order is written. Anything that refuses from here on
     * rolls the whole transaction back, so a refused order never leaves stock claimed.
     */
    const claimed = await claimStock(
      client,
      (cart.lines as (typeof cart.lines[number] & { productId: number })[]).map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        name: l.name,
      })),
    );
    if (!claimed.ok) {
      await client.query("ROLLBACK");
      return Response.json(
        {
          error:
            claimed.left === 0
              ? `${claimed.name} has just sold out. Please remove it from your basket, or call us and we will tell you when the next one lands.`
              : `Only ${claimed.left} of ${claimed.name} ${claimed.left === 1 ? "is" : "are"} left. Please lower the quantity in your basket.`,
          outOfStock: true,
        },
        { status: 409 },
      );
    }

    const { rows } = await client.query(
      `INSERT INTO orders (email, name, phone, address, address2, city, county, postcode, country, landmark,
                           shipping_method, payment_method, delivery_fee_tbc,
                           subtotal_cents, shipping_cents, total_cents, vat_cents,
                           discount_cents, coupon_code, customer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'','Oman',$8,'home-delivery',$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id, number, status`,
      [d.email, d.name, d.phone, d.area, d.building, d.wilaya, d.governorate, d.landmark, d.paymentMethod,
       totals.deliveryTbc, totals.subtotalCents, fee ?? 0, totals.totalCents, vatIncluded(totals.totalCents),
       totals.discountCents, couponCode, note],
    );
    const order = rows[0];

    /*
     * Only now, with the order written, is the redemption taken. If it fails -- the last
     * one went to someone else while this form was being filled in -- the whole
     * transaction unwinds, including the order, and the shopper is told. The alternative,
     * keeping the order and quietly dropping the discount, would charge them more than
     * they agreed to.
     */
    if (prepared?.ok) {
      const committed = await commitRedemption(client, {
        coupon: prepared.coupon,
        orderId: order.id,
        phoneHash: prepared.phoneHash,
        discountCents: totals.discountCents,
      });
      if (!committed.ok) {
        await client.query("ROLLBACK");
        await pool.query("UPDATE carts SET coupon_id = NULL WHERE id = $1", [cartId]).catch(() => {});
        return Response.json(
          { error: refusalMessage(committed.reason, formatPrice, 0), couponRejected: true },
          { status: 409 },
        );
      }
    }

    /*
     * The order's own first event. Without this the history on an order began at the
     * first thing an admin did to it, so an order nobody had touched yet showed an empty
     * trail and there was no record of when it arrived or that the customer placed it.
     * from_status is NULL because there was no previous state, which is the same shape
     * setOrderStatus() writes.
     */
    await client.query(
      `INSERT INTO order_events (order_id, admin_user_id, actor_name, from_status, to_status, note)
       VALUES ($1, NULL, 'Customer', NULL, $2, '')`,
      [order.id, order.status],
    );

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
    return Response.json({ order: { id: order.id, number: order.number } }, { status: 201 });
  } catch (err) {
    // Guarded like updateProduct(): on a dead connection ROLLBACK throws too, and an
    // unguarded await here would replace the real error with that one.
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
