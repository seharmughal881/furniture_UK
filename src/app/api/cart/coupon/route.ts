import { headers } from "next/headers";
import { currentCartId, readCart } from "@/lib/cart";
import { checkCoupon, setCartCoupon } from "@/lib/coupons";
import { refusalMessage } from "@/lib/pricing";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { formatPrice } from "@/lib/types";
import { badRequest, cartCouponSchema } from "@/lib/validation";

/**
 * Applying and removing a discount code.
 *
 * Applying does not redeem. Nothing here moves a counter or writes a redemption row -- it
 * records "this basket is claiming this code" and recomputes the basket. The money is
 * only committed inside /api/checkout, which re-validates from scratch. A shopper who
 * applies a code and never checks out has consumed nothing.
 */

/**
 * The coupon box is the one input on the storefront that rewards guessing, so this is the
 * tightest limit in the app.
 *
 * Fifteen an hour is far more than a real shopper needs -- they have one code off a flyer
 * or an email -- while a script working through a dictionary of likely codes
 * ("WELCOME10", "SALE20", "EID25") gets fifteen tries and then an hour of silence per
 * address. Every attempt counts, not just the failures: counting only failures would let
 * someone who already holds one valid code interleave it with guesses and never be
 * limited at all.
 */
const TRIES_PER_HOUR = 15;
const HOUR_SECONDS = 60 * 60;

export async function POST(request: Request) {
  const parsed = cartCouponSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your basket is empty" }, { status: 404 });

  const quota = await hit(bucketFor("cart-coupon", callerIp(await headers())), TRIES_PER_HOUR, HOUR_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Too many codes tried. Please wait a little before trying another." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  // The subtotal comes from the basket as the database sees it, never from the request,
  // so the minimum-spend rule cannot be cleared by claiming a larger basket.
  const before = await readCart(cartId);
  if (before.lines.length === 0) return Response.json({ error: "Your basket is empty" }, { status: 400 });

  const result = await checkCoupon(parsed.data.code, before.subtotalCents);
  if (!result.ok) {
    return Response.json(
      { error: refusalMessage(result.reason, formatPrice, result.shortfallCents), cart: before },
      { status: 422 },
    );
  }

  await setCartCoupon(cartId, result.coupon.id);
  return Response.json(await readCart(cartId));
}

/** Remove whatever code is on the basket. Idempotent: removing nothing is not an error. */
export async function DELETE() {
  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your basket is empty" }, { status: 404 });
  await setCartCoupon(cartId, null);
  return Response.json(await readCart(cartId));
}
