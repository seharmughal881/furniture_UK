import { currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { badRequest, cartShippingSchema } from "@/lib/validation";

/**
 * The basket's delivery estimator: remember which governorate the shopper picked, and
 * hand back the basket with the quote recalculated.
 *
 * The quote itself is never accepted from the request. The client sends a governorate and
 * nothing else; readCart() looks up that zone's terms and works out the fee, so a crafted
 * request can at most ask "what does delivery to Dhofar cost", which is a question the
 * page answers in public anyway.
 *
 * No rate limit here, unlike the note and coupon routes: this writes one short, enumerated
 * value (zod restricts it to the eleven governorates) to a row the caller already owns,
 * and reveals nothing that is not already on the delivery page.
 */
export async function PUT(request: Request) {
  const parsed = cartShippingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your basket is empty" }, { status: 404 });

  await pool.query("UPDATE carts SET ship_governorate = $2, updated_at = now() WHERE id = $1", [
    cartId,
    parsed.data.governorate,
  ]);
  return Response.json(await readCart(cartId));
}
