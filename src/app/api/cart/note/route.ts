import { headers } from "next/headers";
import { currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { badRequest, cartNoteSchema } from "@/lib/validation";

/**
 * The note the customer attaches to their basket ("call before you come", "the blue gate
 * on the left"). PUT replaces it; sending "" removes it.
 */

/**
 * Generous for a person, pointless for a script. The drawer saves on blur, not on every
 * keystroke, so even a shopper rewriting their note repeatedly stays well inside this.
 */
const SAVES_PER_HOUR = 60;
const HOUR_SECONDS = 60 * 60;

export async function PUT(request: Request) {
  const parsed = cartNoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  // No basket means nothing to attach a note to. Deliberately not ensureCartId(): a note
  // on its own must not be able to mint carts, which would let anyone fill the table.
  const cartId = await currentCartId();
  if (!cartId) return Response.json({ error: "Your basket is empty" }, { status: 404 });

  const quota = await hit(bucketFor("cart-note", callerIp(await headers())), SAVES_PER_HOUR, HOUR_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Too many changes just now. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  await pool.query("UPDATE carts SET note = $2, updated_at = now() WHERE id = $1", [cartId, parsed.data.note]);
  return Response.json(await readCart(cartId));
}
