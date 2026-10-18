"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { ROOMS } from "@/lib/catalog-data";
import type { Palette, Product } from "@/lib/types";
import type { FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

type Piece = { kind: FurnitureKind; pos: [number, number, number]; rot?: number };

const VIGNETTES: Record<string, { pieces: Piece[]; palette: Palette; cam: [number, number, number]; look: [number, number, number]; hour: number }> = {
  living: {
    palette: { fabric: "#9aa78c", wood: "#d2b48c", metal: "#b08d57" },
    pieces: [
      { kind: "sofa", pos: [0, 0, -0.4] },
      { kind: "coffeeTable", pos: [0, 0, 0.75] },
      { kind: "floorLamp", pos: [1.35, 0, -0.75] },
    ],
    cam: [3.2, 2.4, 4.2],
    look: [0.1, 0.45, 0],
    hour: 15,
  },
  bedroom: {
    palette: { fabric: "#2c3447", wood: "#6b4a33", metal: "#b08d57" },
    pieces: [
      { kind: "bed", pos: [0, 0, 0] },
      { kind: "nightstand", pos: [1.18, 0, -0.85] },
      { kind: "tableLamp", pos: [1.18, 0.55, -0.85] },
    ],
    cam: [3.4, 2.6, 3.6],
    look: [0.3, 0.45, -0.1],
    hour: 19.8,
  },
  dining: {
    palette: { fabric: "#b65a3a", wood: "#d2b48c", metal: "#2b2b2b" },
    pieces: [
      { kind: "diningTable", pos: [0, 0, 0] },
      { kind: "diningChair", pos: [-0.45, 0, 0.62], rot: Math.PI },
      { kind: "diningChair", pos: [0.45, 0, 0.62], rot: Math.PI },
      { kind: "diningChair", pos: [-0.45, 0, -0.62] },
      { kind: "diningChair", pos: [0.45, 0, -0.62] },
    ],
    cam: [2.8, 2.5, 3.2],
    look: [0, 0.4, 0],
    hour: 13,
  },
  office: {
    palette: { fabric: "#c9963d", wood: "#d2b48c", metal: "#2b2b2b" },
    pieces: [
      { kind: "desk", pos: [0, 0, 0] },
      { kind: "officeChair", pos: [0.1, 0, 0.6], rot: Math.PI + 0.3 },
      { kind: "tableLamp", pos: [-0.5, 0.75, -0.15] },
    ],
    cam: [2.3, 2.0, 2.6],
    look: [0, 0.5, 0],
    hour: 18,
  },
};

function Vignette({ room }: { room: string }) {
  const v = VIGNETTES[room];
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.25;
  });
  return (
    <>
      <PerspectiveCamera makeDefault fov={30} position={v.cam} onUpdate={(c) => c.lookAt(...v.look)} />
      <SceneLights hour={() => v.hour} shadowSize={2.5} shadowMap={1024} />
      <group ref={g}>
        {v.pieces.map((p, i) => (
          <Furniture
            key={i}
            kind={p.kind}
            palette={v.palette}
            position={p.pos}
            rotation-y={p.rot ?? 0}
            delay={i * 0.25}
            spread={0.6}
            glow={() => (v.hour > 19 ? 0.8 : 0)}
          />
        ))}
      </group>
      <ShadowFloor opacity={0.25} />
    </>
  );
}

function Tile({ room, name, count }: { room: string; name: string; count: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "120px 0px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <Link ref={ref} href={`/shop?room=${room}`} className="room-tile">
      <div className="room-view">
        {near && (
          <View style={{ position: "absolute", inset: 0 }}>
            <Vignette room={room} />
          </View>
        )}
      </div>
      <div className="room-meta">
        <h3>{name}</h3>
        <span>{count} pieces →</span>
      </div>
    </Link>
  );
}

export function RoomTiles({ products }: { products: Product[] }) {
  return (
    <div className="room-grid">
      {ROOMS.map((r) => (
        <Tile key={r.slug} room={r.slug} name={r.name} count={products.filter((p) => p.rooms.includes(r.slug)).length} />
      ))}
    </div>
  );
}
