"use client";

import { PerformanceMonitor, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * One fixed, transparent WebGL canvas for the whole site. Every 3D viewport on
 * any page is a drei <View> that tracks a DOM element and renders into this
 * canvas via scissoring — one GL context, many scenes, survives navigation.
 */
export function CanvasRoot({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null!);
  // drop resolution on slow GPUs, raise it again when frames recover
  const [dpr, setDpr] = useState(1.5);
  const [webgl] = useState(() => {
    if (typeof document === "undefined") return true;
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let id = 0;
    const raf = (t: number) => {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={root} className="canvas-root">
      {children}
      {!webgl && (
        <p className="webgl-off" role="status">
          Your browser has 3D graphics turned off, so pieces are shown without their live previews.
        </p>
      )}
      {webgl && (
      <Canvas
        className="gl-canvas"
        eventSource={root}
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
      )}
    </div>
  );
}
