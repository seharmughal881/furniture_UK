import { RoomTiles } from "@/components/home/RoomTiles";
import { ShopGrid } from "@/components/shop/ShopGrid";
import { HeroStory } from "@/components/home/HeroStory";
import { PlannerTeaser } from "@/components/home/PlannerTeaser";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { getMaterials, getProducts } from "@/lib/catalog";

// one hero piece from each room on the home page
const FEATURED = ["loma-sofa", "sora-bed", "fen-dining-table", "ondo-lounge-chair", "mara-dresser", "atlas-desk"];

export default async function Home() {
  const [products, materials] = await Promise.all([getProducts(), getMaterials()]);
  const featured = FEATURED.map((s) => products.find((p) => p.slug === s)).filter((p) => p !== undefined);

  return (
    <main>
      <HeroStory materials={materials} />

      <section className="manifesto">
        <div>
          <div className="num">1</div>
          <p>maker builds each piece, start to finish. Their name is branded under the frame.</p>
        </div>
        <div>
          <div className="num">0</div>
          <p>screws in our case goods. Joinery only — wedged tenons, dovetails, dowels.</p>
        </div>
        <div>
          <div className="num">∞</div>
          <p>a lifetime guarantee on every frame, and re-upholstery for as long as you own it.</p>
        </div>
      </section>

      <section className="section" id="rooms">
        <div className="section-head">
          <h2>
            Shop by <em>room.</em>
          </h2>
          <p>
            Everything for the living room, bedroom, dining room and home office — {products.length} pieces, all made to
            order and all rendered live in your browser.
          </p>
        </div>
        <RoomTiles products={products} />
      </section>

      <section className="section" id="collection" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <h2>
            Customer <em>favourites.</em>
          </h2>
          <p>Hover a piece to pull it apart and see how it is joined. Open one to choose its materials.</p>
        </div>
        <ShopGrid products={featured} all={products} materials={materials} />
        <p style={{ marginTop: 32 }}>
          <Link href="/shop" className="btn">
            Shop all {products.length} pieces →
          </Link>
        </p>
      </section>

      <PlannerTeaser />
      <Footer />
    </main>
  );
}
