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
  return (
    <>
      <Welcome />
      <CartProvider materials={materials}>
        <CanvasRoot>
          <Nav products={products} copy={{ announcement, links: nav.links, departments: nav.departments }} />
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
