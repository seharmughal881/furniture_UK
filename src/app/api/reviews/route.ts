import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { badRequest, reviewSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { productSlug, author, rating, title, body } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO reviews (product_id, author, rating, title, body)
     SELECT id, $2, $3, $4, $5 FROM products WHERE slug = $1
     RETURNING id, author, rating, title, body, is_demo AS "isDemo", created_at::text AS "createdAt"`,
    [productSlug, author, rating, title, body],
  );
  if (!rows[0]) return Response.json({ error: "Unknown product" }, { status: 404 });
  revalidateTag("reviews", { expire: 0 });
  return Response.json({ review: rows[0] }, { status: 201 });
}
