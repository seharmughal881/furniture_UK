"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/shop/ProductCard";
import type { ProductSummary } from "@/lib/types";
import { useWishlist } from "./Wishlist";

export function WishlistView({ index }: { index: ProductSummary[] }) {
  const { list } = useWishlist();
  const bySlug = new Map(index.map((p) => [p.slug, p]));
  const items = list.map((s) => bySlug.get(s)).filter((p): p is ProductSummary => !!p);
  if (!items.length)
    return (
      <div className="empty">
        <p>Tap the ♥ on any product to save it here.</p>
        <Link href="/shop" className="btn">
          Browse products
        </Link>
      </div>
    );
  return <ProductGrid products={items} />;
}

export function WishlistCount() {
  const { list } = useWishlist();
  return (
    <Link href="/wishlist" className="icon-btn wish-link" aria-label={`Wishlist, ${list.length} items`}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-9.3-9.1C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.7 1.2-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.9-1.8 4.5-9.3 9.1-9.3 9.1Z" />
      </svg>
      {list.length > 0 && <span className="wish-count">{list.length}</span>}
    </Link>
  );
}
