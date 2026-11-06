"use client";

import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/components/commerce/Wishlist";
import { ProductGrid } from "@/components/shop/ProductCard";
import type { ProductSummary } from "@/lib/types";

/**
 * Remembers the product being viewed (pass `current`) and lists the others seen recently.
 *
 * The products are fetched for just the remembered slugs (/api/recently-viewed) instead of
 * the page shipping the whole catalogue to look them up. A first-time visitor has none,
 * so nothing is fetched at all.
 */
export function RecentlyViewed({ current }: { current?: string }) {
  const { list, push } = useRecentlyViewed();
  useEffect(() => {
    if (current) push(current);
  }, [current, push]);

  const wanted = list.filter((s) => s !== current).slice(0, 4).join(",");
  const [found, setFound] = useState<{ key: string; items: ProductSummary[] }>({ key: "", items: [] });
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    fetch(`/api/recently-viewed?slugs=${encodeURIComponent(wanted)}`)
      .then((r) => (r.ok ? (r.json() as Promise<ProductSummary[]>) : []))
      .then((items) => live && setFound({ key: wanted, items }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wanted]);

  // only show results that belong to the current list
  const items = wanted && found.key === wanted ? found.items : [];
  if (!items.length) return null;

  return (
    <section className="section recent" aria-labelledby="recent-title" style={{ paddingTop: 0 }}>
      <div className="section-head">
        <h2 id="recent-title">
          Recently <em>viewed</em>
        </h2>
      </div>
      <ProductGrid products={items} morph={false} />
    </section>
  );
}
