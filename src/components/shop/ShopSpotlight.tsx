"use client";

import dynamic from "next/dynamic";
import { useAmbient3D } from "@/components/Canvas3D";
import type { SpotlightConfig } from "./ShopSpotlightScene";

/**
 * A slowly turning, self-assembling 3D piece beside the shop heading.
 *
 * Decoration, and `aria-hidden` because of it. The scene -- and with it three.js, drei and
 * the furniture geometry -- lives in ShopSpotlightScene and is fetched only when
 * useAmbient3D says so: desktop, idle, motion allowed. On a phone the chunk is never
 * requested, which is the point: this ornament used to cost every shop visitor ~891 KB.
 */
const ShopSpotlightScene = dynamic(() => import("./ShopSpotlightScene"), { ssr: false });

// The 3D model shown next to each category's heading.
const SPOTLIGHT: Record<string, SpotlightConfig> = {
  sofas: { kind: "sofa", fabric: "#cdb79a", wood: "#6b4a33", hour: 15 },
  "bedroom-sets": { kind: "bed", fabric: "#8f8d89", wood: "#6b4a33", hour: 19.6 },
  beds: { kind: "bed", fabric: "#e8e0d2", wood: "#d2b48c", hour: 15 },
  storage: { kind: "wardrobe", fabric: "#e8e0d2", wood: "#6b4a33", hour: 14 },
  dining: { kind: "diningTable", fabric: "#e8e0d2", wood: "#d2b48c", hour: 13 },
  tables: { kind: "coffeeTable", fabric: "#e8e0d2", wood: "#6b4a33", hour: 15 },
  mattresses: { kind: "bed", fabric: "#eeebe5", wood: "#d2b48c", hour: 15 },
  lighting: { kind: "floorLamp", fabric: "#e8e0d2", wood: "#6b4a33", hour: 21 },
  decor: { kind: "mirror", fabric: "#e8e0d2", wood: "#b08d57", hour: 15 },
};
const ROOM_SPOTLIGHT: Record<string, keyof typeof SPOTLIGHT> = {
  living: "sofas",
  bedroom: "bedroom-sets",
  dining: "dining",
  outdoor: "lighting",
};

export function ShopSpotlight({ category, room }: { category?: string; room?: string }) {
  const key = (category && SPOTLIGHT[category] ? category : room && ROOM_SPOTLIGHT[room]) || "sofas";
  const ready = useAmbient3D();
  return (
    <div className="shop-spotlight" aria-hidden>
      {ready && <ShopSpotlightScene cfg={SPOTLIGHT[key]} viewKey={key} />}
    </div>
  );
}
