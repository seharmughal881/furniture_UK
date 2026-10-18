"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

const PALETTE = { fabric: "#9aa78c", wood: "#6b4a33", metal: "#b08d57" };

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

export function PlannerTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="teaser">
      <div className="teaser-copy above">
        <p className="label" style={{ color: "#a59c90" }}>
          Room planner
        </p>
        <h2>
          Lay out your room. <em style={{ color: "#e08a5f" }}>Save it.</em> Send it to us.
        </h2>
        <p>
          Drag real Atelier pieces onto a floor plan, turn them, change the hour and watch the lamplight fall. Every
          layout gets its own link so our studio can quote the whole room.
        </p>
        <Link href="/planner" className="btn light">
          Open the planner →
        </Link>
      </div>
      <div className="teaser-view" ref={ref}>
        {seen && (
          <View style={{ position: "absolute", inset: 0 }}>
            <MiniRoom />
          </View>
        )}
      </div>
    </div>
  );
}
