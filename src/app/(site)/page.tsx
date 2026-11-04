import Link from "next/link";
import { Footer } from "@/components/Footer";
import { HeroStory } from "@/components/home/HeroStory";
import { CountUp, Marquee } from "@/components/Motion";
import { PlannerTeaser } from "@/components/home/PlannerTeaser";
import { RoomTiles } from "@/components/home/RoomTiles";
import { CategoryRail, HowToOrder, ShowroomMap, TrustStrip } from "@/components/home/TrustSections";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { ProductGrid } from "@/components/shop/ProductCard";
import { getMaterials, getProductIndex } from "@/lib/catalog";
import { getContent } from "@/lib/content/read";
import type { PlannerTeaserCopy } from "@/components/home/PlannerTeaser";
import { shopifyImage } from "@/lib/images";
import { DELIVERY, savingPercent } from "@/lib/types";

export default async function Home() {
  // The planner teaser is a client component (it drives a WebGL view), so its wording is
  // read here and passed down rather than fetched inside it.
  const [products, materials, teaser] = await Promise.all([
    getProductIndex(),
    getMaterials(),
    getContent<PlannerTeaserCopy & { enabled: boolean }>("planner_teaser"),
  ]);
  // phones open on a real room photo: the Atlas sofa set lounge
  const heroPhoto = (products.find((p) => p.slug === "atlas-sofa-set-1") ?? products.find((p) => p.category === "sofas"))?.image;
  const whyPhoto = (products.find((p) => p.slug === "woodi-sofa-set") ?? products.find((p) => p.category === "sofas"))?.image;
  // best sellers / new arrivals first (featured come first in sort order), furniture only, one per name family
  const furniture = products.filter((p) => p.kind && p.inStock);
  const favourites = furniture.slice(0, 8);
  const deals = [...furniture]
    .filter((p) => !favourites.includes(p))
    .sort((a, b) => savingPercent(b.priceCents, b.compareAtCents) - savingPercent(a.priceCents, a.compareAtCents))
    .slice(0, 4);

  return (
    <main>
      <HeroStory materials={materials} photo={heroPhoto && shopifyImage(heroPhoto, 900)} />

      <Marquee
        items={[
          "Free delivery over OMR 75",
          "توصيل مجاني للطلبات فوق ٧٥ ريال",
          "Delivered in 4–6 days across Oman",
          "Sofa sets made in Oman",
          "طقم كنب صناعة عمانية",
          "Cash on delivery",
          "Order on WhatsApp",
          "6 showrooms across Oman",
          "See it in 3D before you buy",
        ]}
      />

      {/* "Why choose us": the four promises and the numbers, over a real Muscat Furniture room */}
      <section className="why" aria-labelledby="why-title">
        {whyPhoto && <img className="why-bg" src={shopifyImage(whyPhoto, 1400)} alt="" loading="lazy" decoding="async" />}
        <div className="why-inner">
          <h2 id="why-title" className="why-title">
            Muscat Furniture <i aria-hidden>•</i> <em>Why choose us</em>
          </h2>
          <TrustStrip />
          <div className="manifesto">
            <div>
              <div className="num">
                <CountUp to={6} />
              </div>
              <p>Showrooms across Oman</p>
              <small>Muscat · Sohar · Barka · Al-Bidaya · Nizwa · Salalah</small>
            </div>
            <div>
              <div className="num">{DELIVERY.days.replace(" days", "")}</div>
              <p>Days delivery</p>
              <small>Anywhere in Oman · free over OMR 75</small>
            </div>
            <div>
              <div className="num">
                <CountUp to={products.length} />+
              </div>
              <p>Products online</p>
              <small>Sofa sets made in Oman, bedrooms, dining, lighting</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section rooms-dark" id="rooms">
        <div className="section-head">
          <h2>
            Shop by <em>room.</em>
          </h2>
          <p>Living rooms, bedrooms, dining rooms and lighting for every space — all delivered across Oman.</p>
        </div>
        <RoomTiles products={products} />
      </section>

      <CategoryRail products={products} />

      <section className="section" id="collection" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <h2>
            New &amp; <em>best-selling.</em>
          </h2>
          <p>Every piece marked 3D can be turned, opened up and tried in different fabrics before you order.</p>
        </div>
        <ProductGrid products={favourites} />
      </section>

      <HowToOrder />

      {deals.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <h2>
              This week&apos;s <em>savings.</em>
            </h2>
          </div>
          <ProductGrid products={deals} />
          <p style={{ marginTop: 32 }}>
            <Link href="/shop?sort=saving" className="btn">
              See all offers →
            </Link>
          </p>
        </section>
      )}

      <RecentlyViewed index={products} />
      <ShowroomMap />
      {teaser.enabled && <PlannerTeaser copy={teaser} />}
      <Footer />
    </main>
  );
}
