"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { frameFor } from "@/three/framing";
import type { FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

// The 3D model shown next to each category's heading.
const SPOTLIGHT: Record<string, { kind: FurnitureKind; fabric: string; wood: string; hour: number }> = {
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

function Scene({ cfg }: { cfg: (typeof SPOTLIGHT)[string] }) {
  const g = useRef<THREE.Group>(null);
  const frame = frameFor(cfg.kind, 1.05);
  useFrame((s) => {
    if (g.current) g.current.rotation.y = s.clock.elapsedTime * 0.35;
  });
  return (
    <>
      <PerspectiveCamera makeDefault fov={30} position={frame.position} onUpdate={(c) => c.lookAt(...frame.target)} />
      <SceneLights hour={() => cfg.hour} shadowSize={2.5} shadowMap={1024} />
      <group ref={g}>
        <Furniture kind={cfg.kind} palette={{ fabric: cfg.fabric, wood: cfg.wood, metal: "#2b2b2b" }} spread={0.7} glow={() => (cfg.hour > 19 ? 0.9 : 0)} />
      </group>
      <ShadowFloor opacity={0.25} />
    </>
  );
}

/** A slowly turning, self-assembling 3D piece beside the shop heading. */
export function ShopSpotlight({ category, room }: { category?: string; room?: string }) {
  const key = (category && SPOTLIGHT[category] ? category : room && ROOM_SPOTLIGHT[room]) || "sofas";
  const cfg = SPOTLIGHT[key];
  return (
    <div className="shop-spotlight" aria-hidden>
      {/* key remounts the scene so a new category re-plays the assembly */}
      <View key={key} style={{ position: "absolute", inset: 0 }}>
        <Scene cfg={cfg} />
      </View>
    </div>
  );
}
