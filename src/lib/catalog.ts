import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { pool } from "./db";
import type { Material, Product, Review } from "./types";

const PRODUCT_COLUMNS = `id, slug, name, kind, tagline, description, price_cents AS "priceCents",
  lead_time_weeks AS "leadTimeWeeks", width_cm AS "widthCm", depth_cm AS "depthCm", height_cm AS "heightCm",
  category, rooms, details, care,
  (SELECT round(avg(rating), 1)::float FROM reviews r WHERE r.product_id = products.id) AS rating,
  (SELECT count(*)::int FROM reviews r WHERE r.product_id = products.id) AS "reviewCount"`;

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "reviews");
  const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY sort_order, id`);
  return rows;
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "reviews");
  const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = $1`, [slug]);
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
     FROM reviews WHERE product_id = $1 ORDER BY is_demo, created_at DESC LIMIT 50`,
    [productId],
  );
  return rows;
}
