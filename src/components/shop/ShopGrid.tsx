"use client";

import { cardPalette, ProductCard } from "@/components/home/Collection";
import type { Material, Product } from "@/lib/types";

/** Grid of live 3D product cards. `all` keeps each product's curated look stable across filters. */
export function ShopGrid({ products, all, materials }: { products: Product[]; all: Product[]; materials: Material[] }) {
  return (
    <div className="grid">
      {products.map((p, i) => (
        <ProductCard key={p.slug} product={p} index={i} palette={cardPalette(p, all, materials)} />
      ))}
    </div>
  );
}
