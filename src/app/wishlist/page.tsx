import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { WishlistView } from "@/components/commerce/WishlistView";
import { getProductIndex } from "@/lib/catalog";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const index = await getProductIndex();
  return (
    <main>
      <section className="section page">
        <p className="label">Saved for later</p>
        <h1 className="page-title">Your wishlist</h1>
        <WishlistView index={index} />
      </section>
      <Footer />
    </main>
  );
}
