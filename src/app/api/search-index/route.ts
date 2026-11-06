import { getProductIndex } from "@/lib/catalog";

/**
 * The header search's product list, fetched only when someone opens search.
 *
 * It used to be sent inside every page's HTML (the whole catalogue as a prop of the
 * header), which made each page several hundred KB heavier for a box most visitors
 * never open. Only the fields the results list shows are included. Prerendered like
 * /api/products; the same "catalog" cache tag refreshes it.
 */
export async function GET() {
  const index = await getProductIndex();
  return Response.json(
    index.map(({ slug, name, nameAr, category, priceCents, image }) => ({ slug, name, nameAr, category, priceCents, image })),
  );
}
