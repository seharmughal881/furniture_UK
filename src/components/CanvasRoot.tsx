"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Canvas3DProvider, use3D } from "./Canvas3D";

// three.js is only fetched once something calls activate() -- see Canvas3D.tsx.
const GLCanvas = dynamic(() => import("./GLCanvas"), { ssr: false });

/**
 * Does this browser actually do WebGL?
 *
 * Cached at module scope for two reasons. getSnapshot below runs on every render and must
 * return a stable value or useSyncExternalStore loops forever; and the probe allocates a
 * real GL context, which browsers cap (commonly ~16 per page) -- running it per render
 * would exhaust that budget and start killing the canvases the site is using.
 *
 * The answer cannot change after load, so one probe is all there is to do.
 */
let webglSupport: boolean | null = null;

function clientHasWebgl(): boolean {
  if (webglSupport === null) {
    try {
      webglSupport = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

// Support never changes, so there is nothing to subscribe to.
const subscribeNever = () => () => {};

// What the server -- and therefore the first client render, during hydration -- sees.
const webglUnknownOnServer = () => null;

/**
 * One fixed, transparent WebGL canvas for the whole site. Every 3D viewport on
 * any page is a drei <View> that tracks a DOM element and renders into this
 * canvas via scissoring — one GL context, many scenes, survives navigation.
 *
 * The canvas is not mounted until something asks for 3D. GLCanvas was already behind
 * next/dynamic, but a dynamic import is still emitted as an async <script> in the HTML of
 * every page that could reach it, so three.js was downloaded and compiled on the shop,
 * the checkout and the legal pages alike. Keeping the import behind a state flag is what
 * actually holds it back: the chunk is requested the first time `active` turns true.
 */
function CanvasShell({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null!);
  const { active } = use3D();
  // Whether this browser can do WebGL is not knowable on the server, so it must not be
  // decided while rendering. The previous initialiser did exactly that --
  // `typeof document === "undefined" ? true : probe()` -- which is the first cause React
  // lists in its hydration-mismatch message. The server assumed true and emitted the
  // <GLCanvas> Suspense boundary; a browser with WebGL switched off rendered the fallback
  // <p> instead; the trees disagreed and hydration threw. This component sits in the site
  // layout, so that took EVERY page down to the error boundary ("A joint came loose").
  //
  // useSyncExternalStore is the API built for this: it renders the server snapshot (null,
  // "not known yet") during hydration, so both trees match, then re-renders with the real
  // answer immediately afterwards -- before either branch has painted.
  const webgl = useSyncExternalStore(subscribeNever, clientHasWebgl, webglUnknownOnServer);

  useEffect(() => {
    // Lenis smooths the wheel, and a touch screen has no wheel: `smoothTouch` is off by
    // default, so on a phone this loop ran every frame and changed nothing. Skip it there
    // and give the phone its native momentum scrolling back.
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;

    let id = 0;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let cancelled = false;

    // Also code-split: ~20 KB of scroll library that a phone never runs.
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      const raf = (t: number) => {
        lenis!.raf(t);
        id = requestAnimationFrame(raf);
      };
      id = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      lenis?.destroy();
    };
  }, []);

  return (
    <div ref={root} className="canvas-root">
      {children}
      {/* Explicit === comparisons, not truthiness: while webgl is null neither branch may
          render, which is what keeps the first client render identical to the server's. */}
      {webgl === false && active && (
        <p className="webgl-off" role="status">
          Your browser has 3D graphics turned off, so pieces are shown without their live previews.
        </p>
      )}
      {webgl === true && active && <GLCanvas eventSource={root} />}
    </div>
  );
}

export function CanvasRoot({ children }: { children: React.ReactNode }) {
  return (
    <Canvas3DProvider>
      <CanvasShell>{children}</CanvasShell>
    </Canvas3DProvider>
  );
}
