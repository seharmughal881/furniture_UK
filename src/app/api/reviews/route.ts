import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { badRequest, reviewSchema } from "@/lib/validation";

/**
 * Public review submission.
 *
 * Three things changed here when moderation arrived:
 *
 *   1. New reviews are inserted with the table's default status, which v9 set to
 *      'pending'. They are invisible on the storefront until a member of staff approves
 *      them, so this endpoint can no longer be used to publish arbitrary text or to move
 *      a product's star rating.
 *   2. It is rate limited. Two buckets: a few per day in total, and one per product per
 *      day, so a single visitor cannot bury one product in reviews. Counting per product
 *      as well as overall avoids permanently blocking households and offices that share
 *      one address through carrier NAT.
 *   3. The submitter's IP is stored only as a salted hash, so a flood can be traced and
 *      cleaned up without keeping anyone's address.
 *
 * revalidateTag is deliberately NOT called any more. It used to run on every submission,
 * which let anyone flush the whole catalogue cache in a loop; now the cache is only
 * invalidated when a review is actually approved, in the admin action.
 */

const PER_DAY = 5;
const PER_PRODUCT_PER_DAY = 1;
const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { productSlug, author, rating, title, body } = parsed.data;

  const ip = callerIp(await headers());
  const overall = await hit(bucketFor("review", ip), PER_DAY, DAY_SECONDS);
  if (!overall.ok) {
    return Response.json(
      { error: "Thank you — you have already left several reviews today." },
      { status: 429, headers: { "Retry-After": String(overall.retryAfterSeconds) } },
    );
  }
  const perProduct = await hit(
    bucketFor(`review:${productSlug}`, ip),
    PER_PRODUCT_PER_DAY,
    DAY_SECONDS,
  );
  if (!perProduct.ok) {
    return Response.json(
      { error: "You have already reviewed this product today." },
      { status: 429, headers: { "Retry-After": String(perProduct.retryAfterSeconds) } },
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO reviews (product_id, author, rating, title, body, ip_hash)
     SELECT id, $2, $3, $4, $5, $6 FROM products WHERE slug = $1
     RETURNING id, author, rating, title, body, is_demo AS "isDemo", status,
               created_at::text AS "createdAt"`,
    [productSlug, author, rating, title, body, bucketFor("ip", ip)],
  );
  if (!rows[0]) return Response.json({ error: "Unknown product" }, { status: 404 });

  // 202, not 201: it has been accepted but is not published yet.
  return Response.json({ review: rows[0], pending: true }, { status: 202 });
}
