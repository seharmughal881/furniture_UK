"use client";

import { Billboard } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { makeCutout } from "./cutout";

/**
 * The real product photo standing in the room: background removed, cropped to the product,
 * sized to the product's real width, and turned to face the camera.
 */
export function ProductPhoto({ url, height, maxWidth }: { url: string; height: number; maxWidth: number }) {
  const [state, setState] = useState<{ tex: THREE.Texture; aspect: number; alpha: ImageData | null } | null>(null);

  useEffect(() => {
    let alive = true;
    makeCutout(url).then((c) => {
      if (!alive || !c) return;
      const tex = new THREE.CanvasTexture(c.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      // the planner uses this to ignore clicks on the transparent area around the product
      const alpha = c.canvas.getContext("2d")?.getImageData(0, 0, c.canvas.width, c.canvas.height) ?? null;
      setState({ tex, aspect: c.aspect, alpha });
    });
    return () => {
      alive = false;
    };
  }, [url]);
  useEffect(() => () => state?.tex.dispose(), [state]);

  if (!state) return null;
  // sized by the piece's real height; very wide photos are capped so they don't overrun the room
  let h = height;
  let w = h * state.aspect;
  if (w > maxWidth) {
    w = maxWidth;
    h = w / state.aspect;
  }
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003} scale={[1, 0.42, 1]} userData={{ noHit: true }}>
        <circleGeometry args={[w * 0.5, 40]} />
        <meshBasicMaterial color="#000" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <Billboard lockX lockZ position={[0, h / 2, 0]}>
        <mesh userData={{ hitAlpha: state.alpha }}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={state.tex} transparent alphaTest={0.4} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}
