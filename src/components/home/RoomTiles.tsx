import Link from "next/link";
import { getContent } from "@/lib/content/read";
import { shopifyImage } from "@/lib/images";
import type { ProductSummary } from "@/lib/types";

type Tile = {
  name: string;
  href: string;
  photo: string;
  hoverPhoto: string;
  countBy: "room" | "category";
  countValue: string;
};

/*
 * Each tile shows real product photos, named by product web address and editable in the
 * back office. If a chosen product leaves the catalogue the tile falls back to the first
 * product of that room or category that has a photo, so a tile never renders empty.
 */
const srcSet = (src: string) => [400, 800].map((w) => `${shopifyImage(src, w)} ${w}w`).join(", ");
const SIZES = "(max-width: 720px) 50vw, 25vw";

export async function RoomTiles({ products }: { products: ProductSummary[] }) {
  const { tiles } = await getContent<{ tiles: Tile[] }>("room_tiles");
  return (
    <div className="room-grid">
      {tiles.map((t) => {
        const inRoom = products.filter((p) =>
          t.countBy === "category" ? p.category === t.countValue : p.rooms.includes(t.countValue),
        );
        const photos = [t.photo, t.hoverPhoto]
          .filter(Boolean)
          .map((slug) => products.find((p) => p.slug === slug)?.image)
          .filter((src): src is string => !!src);
        const fallback = inRoom.find((p) => p.image)?.image;
        const [main, hover] = photos.length ? photos : fallback ? [fallback] : [];
        return (
          <Link key={t.name} href={t.href} className="room-tile">
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
