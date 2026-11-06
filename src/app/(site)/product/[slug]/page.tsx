import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { ProductExperience } from "@/components/product/ProductExperience";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { Reviews } from "@/components/product/Reviews";
import { ProductGrid } from "@/components/shop/ProductCard";
import { getMaterials, getProduct, getProductIndex, getProducts, getReviews } from "@/lib/catalog";
import { getDepth } from "@/lib/depth";
import { shopifyImage } from "@/lib/images";

export async function generateStaticParams() {
  // prerender the best sellers; the rest render on first visit and are then cached
  const products = await getProducts();
  return products.slice(0, 40).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: product.tagline, images: product.images.slice(0, 1) },
  };
}

async function Product({ params }: { params: PageProps<"/product/[slug]">["params"] }) {
  const { slug } = await params;
  const [product, materials, index, depth] = await Promise.all([
    getProduct(slug),
    getMaterials(),
    getProductIndex(),
    getDepth(slug),
  ]);
  if (!product) notFound();
  const reviews = await getReviews(product.id);

  const related = index.filter((p) => p.slug !== product.slug && p.category === product.category).slice(0, 4);

  // Structured data for search engines. Sample reviews are excluded from the rating.
  const real = reviews.filter((r) => !r.isDemo);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description.slice(0, 500),
    sku: product.sku || product.slug,
    image: product.images.slice(0, 3),
    brand: { "@type": "Brand", name: "Muscat Furniture" },
    category: product.category,
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 1000).toFixed(3),
      priceCurrency: "OMR",
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `/product/${product.slug}`,
    },
    ...(real.length && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: (real.reduce((s, r) => s + r.rating, 0) / real.length).toFixed(1),
        reviewCount: real.length,
      },
    }),
  };

  const hero = product.images[0];
  return (
    <>
      {hero && (
        <link
          rel="preload"
          as="image"
          href={shopifyImage(hero, 800)}
          imageSrcSet={[400, 800, 1400].map((w) => `${shopifyImage(hero, w)} ${w}w`).join(", ")}
          imageSizes="(max-width: 999px) 100vw, 55vw"
          fetchPriority="high"
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductExperience product={product} materials={materials} depth={depth} />
      <Reviews productSlug={product.slug} productName={product.name} initial={reviews} />
      {related.length > 0 && (
        <section className="section related" aria-labelledby="related-title">
          <div className="section-head">
            <h2 id="related-title">
              You may <em>also like</em>
            </h2>
          </div>
          <ProductGrid products={related} />
        </section>
      )}
      <RecentlyViewed current={product.slug} />
    </>
  );
}

export default function ProductPage(props: PageProps<"/product/[slug]">) {
  return (
    <main>
      <Suspense fallback={<div className="product" aria-busy="true" />}>
        <Product params={props.params} />
      </Suspense>
      <Footer />
    </main>
  );
}
