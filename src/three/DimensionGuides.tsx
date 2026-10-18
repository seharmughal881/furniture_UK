"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Text sprite drawn on a canvas, so no font files need downloading. */
function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 80;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b4532a";
    g.beginPath();
    g.roundRect(8, 12, 240, 56, 28);
    g.fill();
    g.fillStyle = "#f4f0e8";
    g.font = "600 34px ui-monospace, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 42);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[0.32, 0.1, 1]} renderOrder={20}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

/** Width / depth / height measurement lines around a piece (sizes in cm). */
export function DimensionGuides({ widthCm, depthCm, heightCm }: { widthCm: number; depthCm: number; heightCm: number }) {
  const w = widthCm / 100;
  const d = depthCm / 100;
  const h = heightCm / 100;
  const gap = 0.16;
  const tick = 0.05;

  const geometry = useMemo(() => {
    const zf = d / 2 + gap; // width line in front
    const xr = w / 2 + gap; // depth + height lines on the right
    const y = 0.006;
    // prettier-ignore
    const pts = [
      -w / 2, y, zf,  w / 2, y, zf,
      -w / 2, y, zf - tick, -w / 2, y, zf + tick,
       w / 2, y, zf - tick,  w / 2, y, zf + tick,
      xr, y, -d / 2,  xr, y, d / 2,
      xr - tick, y, -d / 2,  xr + tick, y, -d / 2,
      xr - tick, y,  d / 2,  xr + tick, y,  d / 2,
      xr, 0, -d / 2,  xr, h, -d / 2,
      xr - tick, h, -d / 2,  xr + tick, h, -d / 2,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, d, h]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={19}>
        <lineBasicMaterial color="#b4532a" depthTest={false} transparent />
      </lineSegments>
      <Label text={`W ${widthCm} cm`} position={[0, 0.07, d / 2 + gap + 0.08]} />
      <Label text={`D ${depthCm} cm`} position={[w / 2 + gap + 0.2, 0.07, 0]} />
      <Label text={`H ${heightCm} cm`} position={[w / 2 + gap + 0.2, h / 2, -d / 2]} />
    </group>
  );
}
