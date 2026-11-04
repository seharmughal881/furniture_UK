import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { pool } from "./db";
import type { Material, Product, ProductSummary, Review, Store } from "./types";

const PRODUCT_COLUMNS = `id, slug, name, kind, tagline, description, price_cents AS "priceCents",
  lead_time_weeks AS "leadTimeWeeks", width_cm AS "widthCm", depth_cm AS "depthCm", height_cm AS "heightCm",
  category, rooms, details, care, name_ar AS "nameAr", images, compare_at_cents AS "compareAtCents",
  in_stock AS "inStock", featured, colour, sku, variants,
  -- Only approved reviews count towards the shown rating. Without this filter an
  -- unmoderated submission would move the star rating (and the aggregateRating that
  -- search engines read) the instant a stranger posted it.
  (SELECT round(avg(rating), 1)::float FROM reviews r
    WHERE r.product_id = products.id AND r.status = 'approved') AS rating,
  (SELECT count(*)::int FROM reviews r
    WHERE r.product_id = products.id AND r.status = 'approved') AS "reviewCount"`;

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "reviews");
  const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE active ORDER BY sort_order, id`);
  return rows;
}

/** Everything the menus, search and product cards need, without descriptions. */
export async function getProductIndex(): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { rows } = await pool.query(
    `SELECT slug, name, name_ar AS "nameAr", kind, category, rooms, price_cents AS "priceCents",
            compare_at_cents AS "compareAtCents", in_stock AS "inStock", colour,
            images[1] AS image, images[2] AS image2,
            (SELECT count(*) FROM jsonb_array_elements(variants) v WHERE v->>'title' <> '') > 1 AS "hasOptions"
     FROM products WHERE active ORDER BY sort_order, id`,
  );
  return rows;
}

export async function getStores(): Promise<Store[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { rows } = await pool.query(
    `SELECT slug, name, city, address, phone, whatsapp, email, hours, kind FROM stores ORDER BY sort_order`,
  );
  return rows;
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "reviews");
  const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = $1 AND active`, [slug]);
  return rows[0] ?? null;
}

export async function getMaterials(): Promise<Material[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { rows } = await pool.query(
    `SELECT id, slug, name, role, hex, note FROM materials ORDER BY sort_order, id`,
  );
  return rows;
}

export async function getReviews(productId: number): Promise<Review[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");
  const { rows } = await pool.query(
    `SELECT id, author, rating, title, body, is_demo AS "isDemo", created_at::text AS "createdAt"
     FROM reviews
     WHERE product_id = $1 AND status = 'approved'
     ORDER BY is_demo, created_at DESC LIMIT 50`,
    [productId],
  );
  return rows;
}
