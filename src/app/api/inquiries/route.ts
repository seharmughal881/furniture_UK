import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { badRequest, inquirySchema } from "@/lib/validation";

/**
 * Quote requests from the product configurator. Rate limited, and the submitter's IP is
 * kept only as a salted hash so a flood can be cleaned up without storing addresses.
 *
 * Rows land with status 'new' (the v9 default) and appear in the admin inbox at
 * /admin/inquiries. Before v9 nothing ever read this table.
 */

const PER_DAY = 10;
const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { productSlug, name, email, message, config } = parsed.data;

  const ip = callerIp(await headers());
  const quota = await hit(bucketFor("inquiry", ip), PER_DAY, DAY_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "You have sent several enquiries today. Please call us instead — we would love to help." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO inquiries (product_id, name, email, message, config, ip_hash)
     SELECT id, $2, $3, $4, $5::jsonb, $6 FROM products WHERE slug = $1
     RETURNING id, created_at AS "createdAt"`,
    [productSlug, name, email, message, JSON.stringify(config), bucketFor("ip", ip)],
  );
  if (!rows[0]) return Response.json({ error: "Unknown product" }, { status: 404 });
  return Response.json({ inquiry: rows[0] }, { status: 201 });
}
