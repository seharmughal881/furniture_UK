import type { NextRequest } from "next/server";
import { getProductIndex } from "@/lib/catalog";

/**
 * The "Recently viewed" row's products: only the few slugs the visitor's browser remembers
 * (?slugs=a,b,c), in that order. The row used to receive the whole catalogue in every
 * home and product page's HTML just to look these up. Unknown slugs are skipped.
 */
export async function GET(request: NextRequest) {
  const slugs = (request.nextUrl.searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 8);
  if (!slugs.length) return Response.json([]);
  const bySlug = new Map((await getProductIndex()).map((p) => [p.slug, p]));
  return Response.json(slugs.map((s) => bySlug.get(s)).filter(Boolean), {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
