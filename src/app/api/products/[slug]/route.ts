import type { NextRequest } from "next/server";
import { getProduct } from "@/lib/catalog";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/products/[slug]">) {
  const { slug } = await ctx.params;
  const product = await getProduct(slug);
  if (!product) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ product });
}
