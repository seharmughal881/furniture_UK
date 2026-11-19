"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Decides when three.js is allowed to load.
 *
 * The engine is ~891 KB uncompressed -- more than every other script on the site put
 * together -- and it used to arrive as an async <script> in the HTML of every page, shop
 * and checkout and legal pages included, none of which draw anything in 3D. Downloading it
 * is the smaller cost; parsing and compiling it is what stalls a mid-range phone.
 *
 * So nothing loads it until something asks. `activate()` is the ask, and CanvasRoot mounts
 * GLCanvas (and with it three.js) the first time it is called. Two kinds of caller:
 *
 *   - a real 3D control the customer pressed, e.g. the "View in 3D" tab on a product, or
 *     the planner, which is a 3D page by definition. These call activate() directly.
 *   - the decorative scenes on the home and shop pages, which nobody asked for. Those use
 *     useAmbient3D(), which stays off on phones entirely and, on a desktop, waits for the
 *     browser to go idle so the engine never competes with the first paint.
 *
 * Once on, it stays on: the canvas is shared across navigations and tearing it down would
 * throw away the compiled shaders.
 */

type Canvas3DValue = { active: boolean; activate: () => void };

const Canvas3DContext = createContext<Canvas3DValue>({ active: false, activate: () => {} });

export function Canvas3DProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);
  const value = useMemo(() => ({ active, activate }), [active, activate]);
  return <Canvas3DContext.Provider value={value}>{children}</Canvas3DContext.Provider>;
}

/** For a 3D control the customer actually pressed. */
export function use3D() {
  return useContext(Canvas3DContext);
}

/**
 * For decoration: a 3D scene the customer did not ask for.
 *
 * Never on a phone -- a coarse pointer or a narrow screen means the engine would cost more
 * than the ornament is worth, and the home page's hero scene is desktop-only anyway. On a
 * desktop it waits for an idle moment, so three.js arrives after the page is usable rather
 * than alongside it. Returns whether the shared canvas is up yet; until it is, a <View>
 * renders nothing, which is why callers keep their own still image behind it.
 */
export function useAmbient3D(): boolean {
  const { active, activate } = use3D();

  useEffect(() => {
    if (active) return;
    if (typeof window === "undefined") return;
    // Phones, tablets and anyone who asked for less motion: leave it off.
    if (window.matchMedia("(max-width: 900px), (pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    // Respect a metered connection if the browser reports one.
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => activate());
    return () => cancel(id as number);
  }, [active, activate]);

  return active;
}
