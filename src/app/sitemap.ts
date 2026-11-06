import type { MetadataRoute } from "next";
import { getProducts, getStores } from "@/lib/catalog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, stores] = await Promise.all([getProducts(), getStores()]);
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/shop`, priority: 0.9 },
    { url: `${base}/planner`, priority: 0.7 },
    { url: `${base}/help`, priority: 0.4 },
    { url: `${base}/stores`, priority: 0.6 },
    ...stores.map((s) => ({ url: `${base}/stores/${s.slug}`, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, priority: 0.8 })),
  ];
}
