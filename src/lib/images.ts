/**
 * Shopify's CDN resizes on the fly; ask for the width the layout needs.
 *
 * The "/cdn/shop/" test matches site-relative paths too, and imageUrlSchema (as well as
 * the admin's ImageManager) accepts any "/path" -- so `new URL(src)` here would throw a
 * TypeError on a pasted "/cdn/shop/foo.jpg" and 500 the server component that rendered
 * it. Relative paths are resolved against a throwaway base and returned relative again;
 * anything unparseable is handed back untouched rather than taking the page down.
 */
export function shopifyImage(src: string, width: number) {
  if (!src.includes("cdn.shopify.com") && !src.includes("/cdn/shop/")) return src;
  const relative = src.startsWith("/");
  let u: URL;
  try {
    u = new URL(src, relative ? "https://relative.invalid" : undefined);
  } catch {
    return src;
  }
  u.searchParams.set("width", String(width));
  return relative ? `${u.pathname}${u.search}${u.hash}` : u.toString();
}
