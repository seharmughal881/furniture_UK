"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { formatPrice, type Material, type Palette, type Product } from "@/lib/types";
import { FOOTPRINT, HEIGHT, type FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

/** Camera position that frames a piece of furniture nicely. */
export function frameFor(kind: FurnitureKind, zoom = 1) {
  const [w] = FOOTPRINT[kind];
  const h = HEIGHT[kind];
  const dist = (Math.max(w * 1.05, h * 1.25) * 2.05 + 0.6) * zoom;
  const dir = [0.75, 0.42, 1].map((v) => v / Math.hypot(0.75, 0.42, 1));
  return {
    position: [dir[0] * dist, h / 2 + dir[1] * dist, dir[2] * dist] as [number, number, number],
    target: [0, h * 0.45, 0] as [number, number, number],
  };
}

type CardState = { visibleAt: number | null; hover: number; hoverTarget: number };

function CardScene({ kind, palette, state }: { kind: FurnitureKind; palette: Palette; state: React.RefObject<CardState> }) {
  const group = useRef<THREE.Group>(null);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const frame = frameFor(kind);
  const assembled = useRef(0);

  useFrame((s, dt) => {
    const st = state.current;
    st.hover += (st.hoverTarget - st.hover) * (1 - Math.exp(-dt * 6));
    assembled.current = st.visibleAt === null ? 0 : Math.min(1, (performance.now() - st.visibleAt) / 2400);
    if (group.current) group.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.35 - 0.2;
    if (cam.current) cam.current.lookAt(...frame.target);
  });

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault fov={30} position={frame.position} />
      <SceneLights hour={() => 14.5} shadowSize={2} shadowMap={1024} />
      <group ref={group}>
        <Furniture
          kind={kind}
          palette={palette}
          spread={0.7}
          // hover pulls the piece apart to show its joinery
          assembly={() => assembled.current}
          explode={() => state.current.hover * 0.7}
        />
      </group>
      <ShadowFloor opacity={0.22} />
    </>
  );
}

export function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!rating || !count) return null;
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <span aria-hidden style={{ "--r": rating } as React.CSSProperties} />
      <small>
        {rating.toFixed(1)} ({count})
      </small>
    </span>
  );
}

export function ProductCard({ product, palette, index }: { product: Product; palette: Palette; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const state = useRef<CardState>({ visibleAt: null, hover: 0, hoverTarget: 0 });
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && state.current.visibleAt === null) {
          state.current.visibleAt = performance.now() + (index % 3) * 120;
          setNear(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "120px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index]);

  return (
    <Link
      ref={ref}
      href={`/product/${product.slug}`}
      className="card"
      onPointerEnter={() => (state.current.hoverTarget = 1)}
      onPointerLeave={() => (state.current.hoverTarget = 0)}
    >
      <div className="card-view">
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="card-hint">Hover · see inside</span>
        {near && (
          <View style={{ position: "absolute", inset: 0 }}>
            <CardScene kind={product.kind} palette={palette} state={state} />
          </View>
        )}
      </div>
      <div className="card-body">
        <span className="card-cat">{product.category}</span>
        <Stars rating={product.rating} count={product.reviewCount} />
        <h3>{product.name}</h3>
        <span className="price">{formatPrice(product.priceCents)}</span>
        <p>{product.tagline}</p>
      </div>
    </Link>
  );
}

// fabric / wood / metal slugs shown on each card, in catalogue order
const CARD_LOOKS = [
  ["sage-linen", "white-oak", "brushed-steel"],
  ["terracotta-velvet", "smoked-walnut", "black-steel"],
  ["boucle-ivory", "smoked-walnut", "aged-brass"],
  ["boucle-ivory", "white-oak", "aged-brass"],
  ["boucle-ivory", "white-oak", "brushed-steel"],
  ["midnight-wool", "white-oak", "black-steel"],
];

/** The curated look for a product card, keyed by the product's catalogue position. */
export function cardPalette(product: Product, products: Product[], materials: Material[]): Palette {
  const i = Math.max(0, products.findIndex((p) => p.slug === product.slug));
  const look = CARD_LOOKS[i % CARD_LOOKS.length];
  const hex = (slug: string, role: string) =>
    (materials.find((m) => m.slug === slug) ?? materials.find((m) => m.role === role))?.hex ?? "#cccccc";
  return { fabric: hex(look[0], "fabric"), wood: hex(look[1], "wood"), metal: hex(look[2], "metal") };
}

export function Collection({ products, materials }: { products: Product[]; materials: Material[] }) {
  return (
    <div className="grid">
      {products.map((p, i) => (
        <ProductCard
          key={p.slug}
          product={p}
          index={i}
          palette={cardPalette(p, products, materials)}
        />
      ))}
    </div>
  );
}
