import Link from "next/link";
import { shopifyImage } from "@/lib/images";
import type { ProductSummary } from "@/lib/types";

// Real Muscat Furniture room photos for each tile: chosen from the catalogue for being styled rooms
// without price banners printed on them. A second photo crossfades in on hover. If a chosen product
// leaves the catalogue, the tile falls back to the first product of that room that has a photo.
const TILES = [
  {
    key: "living",
    name: "Living room",
    href: "/shop?room=living",
    photos: ["atlas-sofa-set-1", "stainly-sofa-set"],
    match: (p: ProductSummary) => p.rooms.includes("living"),
  },
  {
    key: "bedroom",
    name: "Bedroom",
    href: "/shop?room=bedroom",
    photos: ["euro-star-bedroom-set-10-piece", "atlanta-bedroom-set"],
    match: (p: ProductSummary) => p.rooms.includes("bedroom"),
  },
  {
    key: "dining",
    name: "Dining room",
    href: "/shop?room=dining",
    photos: ["jafiya-dining-table-set-6-chairs-copy", "gafiya-dining-table-set-6-chairs-black-grey-copy"],
    match: (p: ProductSummary) => p.rooms.includes("dining"),
  },
  {
    key: "lighting",
    name: "Lighting",
    href: "/shop?category=lighting",
    photos: ["perry-modern-chandelier-pendant-3", "aj-ak-modern-chandelier-pendant"],
    match: (p: ProductSummary) => p.category === "lighting",
  },
];

const srcSet = (src: string) => [400, 800].map((w) => `${shopifyImage(src, w)} ${w}w`).join(", ");
const SIZES = "(max-width: 720px) 50vw, 25vw";

export function RoomTiles({ products }: { products: ProductSummary[] }) {
  return (
    <div className="room-grid">
      {TILES.map((t) => {
        const inRoom = products.filter(t.match);
        const photos = t.photos
          .map((slug) => products.find((p) => p.slug === slug)?.image)
          .filter((src): src is string => !!src);
        const fallback = inRoom.find((p) => p.image)?.image;
        const [main, hover] = photos.length ? photos : fallback ? [fallback] : [];
        return (
          <Link key={t.key} href={t.href} className="room-tile">
            <div className="room-view">
              {main && <img className="room-photo" src={shopifyImage(main, 800)} srcSet={srcSet(main)} sizes={SIZES} alt="" loading="lazy" decoding="async" />}
              {hover && (
                <img className="room-photo hover" src={shopifyImage(hover, 800)} srcSet={srcSet(hover)} sizes={SIZES} alt="" loading="lazy" decoding="async" />
              )}
            </div>
            <div className="room-meta">
              <h3>{t.name}</h3>
              <span>{inRoom.length} products →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
