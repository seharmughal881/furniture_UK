import { shopifyImage } from "./images";
import videos from "./product-videos.json";
import type { ProductSummary } from "./types";

/**
 * A client product video (hosted on Shopify's CDN), with the product it belongs to. The still image
 * is the product's photo: Shopify's own video thumbnail is the first frame, often a dark fade-in.
 */
export type CategoryVideo = { slug: string; name: string; sd: string; hd: string; poster: string };

// Categories with no videos of their own borrow the closest related ones (a bedroom-set video shows
// the bed, wardrobe and dresser; a sofa-set video shows the coffee table and decor).
const RELATED: Record<string, string[]> = {
  beds: ["bedroom-sets"],
  mattresses: ["beds", "bedroom-sets"],
  bedding: ["beds", "bedroom-sets"],
  storage: ["bedroom-sets"],
  tables: ["sofas", "dining"],
  decor: ["sofas", "lighting"],
  switches: ["lighting"],
  sanitary: ["lighting"],
};
const ROOMS: Record<string, string[]> = {
  living: ["sofas", "tables"],
  bedroom: ["bedroom-sets", "beds", "storage"],
  dining: ["dining"],
  outdoor: ["lighting"],
};
const EVERYTHING = ["sofas", "bedroom-sets", "dining", "lighting"];

const all = videos as Record<string, { sd: string; hd: string; poster: string }>;

/**
 * Videos for a category (or room), its own products' first, then related categories, then anything,
 * so every category always has a video. Varied: one per product.
 */
export function videosFor(index: ProductSummary[], opts: { category?: string; room?: string; max?: number }) {
  const { category, room, max = 6 } = opts;
  const order = category ? [category, ...(RELATED[category] ?? [])] : room ? (ROOMS[room] ?? EVERYTHING) : EVERYTHING;
  const picked: CategoryVideo[] = [];
  const take = (p: ProductSummary) => {
    const v = all[p.slug];
    if (v && picked.length < max && !picked.some((x) => x.slug === p.slug))
      picked.push({ slug: p.slug, name: p.name, sd: v.sd, hd: v.hd, poster: p.image ? shopifyImage(p.image, 600) : v.poster });
  };
  for (const c of [...order, ...EVERYTHING]) index.filter((p) => p.category === c).forEach(take);
  return picked;
}
