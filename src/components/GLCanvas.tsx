"use client";

import { PerformanceMonitor, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState, type RefObject } from "react";
import * as THREE from "three";

/**
 * The shared WebGL canvas itself. Split out of CanvasRoot and loaded with next/dynamic,
 * so three.js (~900 KB before compression) is no longer part of every page's first load:
 * the page paints and becomes usable, then the 3D engine arrives. Pages with 3D render
 * drei <View>s, which wait in the tunnel until <View.Port /> here mounts.
 */
export default function GLCanvas({ eventSource }: { eventSource: RefObject<HTMLDivElement> }) {
  /**
   * Start low on a phone and let PerformanceMonitor earn the resolution back. 1.5 on a
   * device with devicePixelRatio 3 is over four times the pixels of 1.0, paid on the very
   * first frames -- exactly when the phone is still busy with the page itself.
   */
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const [dpr, setDpr] = useState(coarse ? 1 : 1.5);
  return (
    <Canvas
      className="gl-canvas"
      eventSource={eventSource}
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={dpr}
      // "high-performance" asks a laptop for its discrete GPU; on a phone there is no
      // second GPU to pick, so it only signals "do not hold back on power".
      gl={{ antialias: !coarse, alpha: true, powerPreference: coarse ? "default" : "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio))}
        onDecline={() => setDpr(1)}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <View.Port />
    </Canvas>
  );
}
