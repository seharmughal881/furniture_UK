/** Shopify's CDN resizes on the fly; ask for the width the layout needs. */
export function shopifyImage(src: string, width: number) {
  if (!src.includes("cdn.shopify.com") && !src.includes("/cdn/shop/")) return src;
  const u = new URL(src);
  u.searchParams.set("width", String(width));
  return u.toString();
}
