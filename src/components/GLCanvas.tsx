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
  // drop resolution on slow GPUs, raise it again when frames recover
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      className="gl-canvas"
      eventSource={eventSource}
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
        onDecline={() => setDpr(1)}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <View.Port />
    </Canvas>
  );
}
