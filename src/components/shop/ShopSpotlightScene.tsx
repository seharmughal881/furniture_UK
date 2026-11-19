"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { frameFor } from "@/three/framing";
import type { FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/FurniturePiece";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

/**
 * The 3D half of ShopSpotlight, in its own module so that three.js stays out of the shop
 * page's bundle. ShopSpotlight imports this with next/dynamic, and only once the page is
 * idle on a desktop -- so the chunk is never requested on a phone at all.
 */
export type SpotlightConfig = { kind: FurnitureKind; fabric: string; wood: string; hour: number };

export default function ShopSpotlightScene({ cfg, viewKey }: { cfg: SpotlightConfig; viewKey: string }) {
  return (
    // key remounts the scene so a new category re-plays the assembly
    <View key={viewKey} style={{ position: "absolute", inset: 0 }}>
      <Scene cfg={cfg} />
    </View>
  );
}

function Scene({ cfg }: { cfg: SpotlightConfig }) {
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
