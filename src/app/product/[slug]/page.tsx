import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { ProductExperience } from "@/components/product/ProductExperience";
import { Reviews } from "@/components/product/Reviews";
import { ShopGrid } from "@/components/shop/ShopGrid";
import { getMaterials, getProduct, getProducts, getReviews } from "@/lib/catalog";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: `${product.tagline} ${product.description}`.slice(0, 160),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: product.tagline },
  };
}

async function Product({ params }: { params: PageProps<"/product/[slug]">["params"] }) {
  const { slug } = await params;
  const [product, materials, all] = await Promise.all([getProduct(slug), getMaterials(), getProducts()]);
  if (!product) notFound();
  const reviews = await getReviews(product.id);

  const related = [
    ...all.filter((p) => p.slug !== product.slug && p.category === product.category),
    ...all.filter((p) => p.slug !== product.slug && p.category !== product.category),
  ].slice(0, 3);

  // Structured data for search engines. Sample reviews are excluded from the rating.
  const real = reviews.filter((r) => !r.isDemo);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.slug,
    brand: { "@type": "Brand", name: "Atelier" },
    category: product.category,
    width: { "@type": "QuantitativeValue", value: product.widthCm, unitCode: "CMT" },
    depth: { "@type": "QuantitativeValue", value: product.depthCm, unitCode: "CMT" },
    height: { "@type": "QuantitativeValue", value: product.heightCm, unitCode: "CMT" },
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: "GBP",
      availability: "https://schema.org/PreOrder",
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductExperience product={product} materials={materials} />
      <Reviews productSlug={product.slug} productName={product.name} initial={reviews} />
      <section className="section related" aria-labelledby="related-title">
        <div className="section-head">
          <h2 id="related-title">
            Pairs <em>well with</em>
          </h2>
        </div>
        <ShopGrid products={related} all={all} materials={materials} />
      </section>
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
