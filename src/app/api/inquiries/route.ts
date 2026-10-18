import { pool } from "@/lib/db";
import { badRequest, inquirySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = inquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { productSlug, name, email, message, config } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO inquiries (product_id, name, email, message, config)
     SELECT id, $2, $3, $4, $5::jsonb FROM products WHERE slug = $1
     RETURNING id, created_at AS "createdAt"`,
    [productSlug, name, email, message, JSON.stringify(config)],
  );
  if (!rows[0]) return Response.json({ error: "Unknown product" }, { status: 404 });
  return Response.json({ inquiry: rows[0] }, { status: 201 });
}
