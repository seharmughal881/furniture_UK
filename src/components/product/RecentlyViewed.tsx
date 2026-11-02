"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/components/commerce/Wishlist";
import { ProductGrid } from "@/components/shop/ProductCard";
import type { ProductSummary } from "@/lib/types";

/** Remembers the product being viewed (pass `current`) and lists the others seen recently. */
export function RecentlyViewed({ index, current }: { index: ProductSummary[]; current?: string }) {
  const { list, push } = useRecentlyViewed();
  useEffect(() => {
    if (current) push(current);
  }, [current, push]);

  const bySlug = new Map(index.map((p) => [p.slug, p]));
  const items = list
    .filter((s) => s !== current)
    .map((s) => bySlug.get(s))
    .filter((p): p is ProductSummary => !!p)
    .slice(0, 4);
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
