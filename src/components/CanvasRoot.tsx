"use client";

import Lenis from "lenis";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// three.js loads after the page, not with it -- see GLCanvas.
const GLCanvas = dynamic(() => import("./GLCanvas"), { ssr: false });

/**
 * One fixed, transparent WebGL canvas for the whole site. Every 3D viewport on
 * any page is a drei <View> that tracks a DOM element and renders into this
 * canvas via scissoring — one GL context, many scenes, survives navigation.
 */
export function CanvasRoot({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null!);
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
      {webgl && <GLCanvas eventSource={root} />}
    </div>
  );
}
