import Link from "next/link";
import { ViewTransition } from "react";
import { CATEGORIES } from "@/lib/catalog-data";
import { shopifyImage } from "@/lib/images";
import { formatPrice, savingPercent, type ProductSummary } from "@/lib/types";
import { CardActions } from "./CardActions";

export { shopifyImage };

/** Photo product card for the real catalogue. */
export function ProductCard({
  product,
  priority = false,
  morph = true,
}: {
  product: ProductSummary;
  priority?: boolean;
  /** photo morphs into the product page; off where the same product may appear twice */
  morph?: boolean;
}) {
  const save = savingPercent(product.priceCents, product.compareAtCents);
  const category = CATEGORIES.find((c) => c.slug === product.category)?.name ?? product.category;
  return (
    <Link href={`/product/${product.slug}`} className="card photo-card">
      <div className="card-photo">
        {product.image ? (
          <ViewTransition name={morph ? `photo-${product.slug}` : undefined}>
            <img
              src={shopifyImage(product.image, 800)}
              srcSet={`${shopifyImage(product.image, 400)} 400w, ${shopifyImage(product.image, 800)} 800w`}
              sizes="(max-width: 700px) 100vw, 33vw"
              alt={product.name}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
            />
          </ViewTransition>
        ) : (
          <div className="no-photo">No photo</div>
        )}
        <CardActions product={product} />
        <div className="badges">
          {save > 0 && <span className="badge sale">−{save}%</span>}
          {product.kind && <span className="badge three-d">3D</span>}
          {!product.inStock && <span className="badge out">Sold out</span>}
        </div>
      </div>
      <div className="card-body">
        <span className="card-cat">{category}</span>
        <h3>{product.name}</h3>
        {product.nameAr && (
          <p className="name-ar" dir="rtl" lang="ar">
            {product.nameAr}
          </p>
        )}
        <div className="price-line">
          <strong>{formatPrice(product.priceCents)}</strong>
          {save > 0 && product.compareAtCents && <s>{formatPrice(product.compareAtCents)}</s>}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, morph = true }: { products: ProductSummary[]; morph?: boolean }) {
  return (
    <div className="grid photo-grid">
      {products.map((p, i) => (
        <ProductCard key={p.slug} product={p} priority={i < 3} morph={morph} />
      ))}
    </div>
  );
}
