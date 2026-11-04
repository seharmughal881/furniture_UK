import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { badRequest, newsletterSchema } from "@/lib/validation";

/**
 * Newsletter sign-up, with double opt-in.
 *
 * Anyone can post any address here, so an address must confirm before it counts as
 * subscribed: the row is written with confirmed = false and a single-use token, and only
 * /api/newsletter/confirm flips it. **Only ever send mail to rows WHERE confirmed** --
 * that is what stops this endpoint being used to sign a stranger up, or to build a list
 * of addresses that never agreed to anything.
 *
 * The response is identical whether or not the address was already on the list, so this
 * endpoint cannot be used to test which addresses are subscribed.
 *
 * NOT YET WIRED: the confirmation email itself. The project has no mail provider, so the
 * token is generated and stored but nothing delivers it. Until a provider is added, the
 * owner confirms a subscriber from /admin/subscribers. The link to send is:
 *   <site>/api/newsletter/confirm?token=<confirm_token>
 */

const PER_DAY = 5;
const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const parsed = newsletterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  const ip = callerIp(await headers());
  const quota = await hit(bucketFor("newsletter", ip), PER_DAY, DAY_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Too many sign-ups from this connection today." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const token = randomBytes(32).toString("base64url");
  // DO NOTHING on conflict: re-posting an existing address must not reset a confirmed
  // subscription back to unconfirmed, nor hand out a fresh token for someone else's
  // address.
  await pool.query(
    `INSERT INTO newsletter (email, confirm_token) VALUES (lower($1), $2)
     ON CONFLICT (email) DO NOTHING`,
    [parsed.data.email, token],
  );

  return Response.json({ ok: true, pending: true }, { status: 201 });
}
