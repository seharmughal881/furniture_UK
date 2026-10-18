import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/shop`, priority: 0.9 },
    { url: `${base}/planner`, priority: 0.7 },
    { url: `${base}/help`, priority: 0.4 },
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, priority: 0.8 })),
  ];
}
