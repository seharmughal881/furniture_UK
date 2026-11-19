"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Furniture } from "@/three/FurniturePiece";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

/**
 * The little turning room behind the planner teaser, split out so three.js is not part of
 * the home page's bundle. PlannerTeaser pulls this in with next/dynamic once the browser
 * is idle on a desktop; a phone never fetches it.
 */
const PALETTE = { fabric: "#9aa78c", wood: "#6b4a33", metal: "#b08d57" };

export default function PlannerTeaserScene() {
  return (
    <View style={{ position: "absolute", inset: 0 }}>
      <MiniRoom />
    </View>
  );
}

function MiniRoom() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.y = s.clock.elapsedTime * 0.12;
  });
  // dusk, so the lamp is on
  return (
    <>
      <PerspectiveCamera makeDefault fov={32} position={[5.5, 5.2, 6.5]} onUpdate={(c) => c.lookAt(0, 0.2, 0)} />
      <SceneLights hour={() => 19.6} shadowSize={4} />
      <group ref={g}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[5, 4]} />
          <meshStandardMaterial color="#3a332c" roughness={0.9} />
        </mesh>
        <Furniture kind="sofa" palette={PALETTE} position={[0, 0, -1.2]} />
        <Furniture kind="coffeeTable" palette={PALETTE} position={[0, 0, 0]} delay={0.3} />
        <Furniture kind="armchair" palette={PALETTE} position={[1.6, 0, 0.3]} rotation-y={-1.3} delay={0.6} />
        <Furniture kind="floorLamp" palette={PALETTE} position={[-1.5, 0, -1.4]} glow={() => 0.9} delay={0.9} />
        <Furniture kind="bookshelf" palette={PALETTE} position={[-2.1, 0, 0.5]} rotation-y={Math.PI / 2} delay={1.2} />
      </group>
      <ShadowFloor opacity={0.4} />
    </>
  );
}
