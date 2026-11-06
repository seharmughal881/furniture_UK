import { CanvasRoot } from "@/components/CanvasRoot";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { CartProvider } from "@/components/commerce/CartProvider";
import { MotionLayer } from "@/components/Motion";
import { Nav, type NavCopy } from "@/components/Nav";
import { Welcome } from "@/components/Welcome";
import { ViewTransition } from "react";
import { getMaterials, getProductIndex } from "@/lib/catalog";
import { getContent } from "@/lib/content/read";
import "../globals.css";

/**
 * Storefront layout: everything that used to sit in the root layout.
 *
 * It lives in a route group, so the URLs are unchanged -- (site) is not a path segment.
 * Splitting it out of the root is what lets /admin render without the shop header, the
 * basket, the shared WebGL canvas or this file's catalogue queries.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [products, materials, announcement, nav] = await Promise.all([
    getProductIndex(),
    getMaterials(),
    getContent<NavCopy["announcement"]>("announcement"),
    getContent<{ links: NavCopy["links"]; departments: NavCopy["departments"] }>("nav"),
  ]);
  // The header gets per-category counts and the total, not the catalogue itself (which
  // made every page several hundred KB heavier); search fetches /api/search-index.
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1;
  return (
    <>
      {/* Products-per-row: applied before paint, like the welcome script in the root layout,
          so a returning shopper's saved choice is the first thing drawn and the grid never
          jumps from the default. Read by GridDensity in components/shop. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var c=localStorage.getItem("mf_cols");document.documentElement.dataset.cols=c==="2"||c==="3"?c:"4"}catch(e){}`,
        }}
      />
      <Welcome />
      <CartProvider materials={materials}>
        <CanvasRoot>
          <Nav counts={counts} total={products.length} copy={{ announcement, links: nav.links, departments: nav.departments }} />
          <MotionLayer />
          {/* crossfades pages on navigation; product photos morph via named transitions */}
          <ViewTransition>
            <div id="main">{children}</div>
          </ViewTransition>
          <CartDrawer />
        </CanvasRoot>
      </CartProvider>
    </>
  );
}
