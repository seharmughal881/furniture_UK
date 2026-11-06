"use client";

import { useSyncExternalStore } from "react";

/**
 * "Products per row" control for the shop filter bar.
 *
 * The chosen value lives on `<html data-cols>`, not in React state and not in the URL:
 *
 *  - CSS alone then drives both the grid and this control's own active state, so the
 *    right layout is painted before hydration and a returning shopper never sees the
 *    grid jump from the default to their saved choice.
 *  - every other shop filter is in the URL because it changes *which* products are
 *    shown and should be shareable. This one only changes how they look, so putting it
 *    in the URL would cost a server round trip and risk flashing the page skeleton.
 *
 * The attribute is therefore the store, and React subscribes to it rather than owning
 * it -- which is what useSyncExternalStore is for, and why there is no useEffect here.
 *
 * The pre-paint script that seeds the attribute from localStorage is in
 * app/(site)/layout.tsx, beside the one that hides the welcome screen. If scripts are
 * blocked there is no attribute at all, and the stylesheet's default (4) applies.
 */

export const COLS_KEY = "mf_cols";
export const COLS_OPTIONS = [2, 3, 4] as const;
export const DEFAULT_COLS = 4;

type Cols = (typeof COLS_OPTIONS)[number];

const isCols = (n: number): n is Cols => (COLS_OPTIONS as readonly number[]).includes(n);

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // a second tab changing the preference writes to localStorage, not to this document
  const onStorage = (e: StorageEvent) => {
    if (e.key !== COLS_KEY) return;
    const next = Number(e.newValue);
    if (isCols(next)) {
      document.documentElement.dataset.cols = String(next);
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshots are plain numbers, so React can compare them without a cache. */
const getSnapshot = (): Cols => {
  const current = Number(document.documentElement.dataset.cols);
  return isCols(current) ? current : DEFAULT_COLS;
};
const getServerSnapshot = (): Cols => DEFAULT_COLS;

export function GridDensity() {
  const cols = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = (value: Cols) => {
    document.documentElement.dataset.cols = String(value);
    try {
      localStorage.setItem(COLS_KEY, String(value));
    } catch {
      // private browsing blocks storage: the choice still applies, it is just not remembered
    }
    for (const notify of listeners) notify();
  };

  return (
    <div className="density" role="group" aria-label="Products per row">
      {COLS_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          data-value={n}
          className="density-btn"
          // the visible active state comes from html[data-cols] in CSS; this is for screen readers
          aria-pressed={cols === n}
          aria-label={`Show ${n} products per row`}
          title={`${n} per row`}
          onClick={() => choose(n)}
        >
          <span className="density-icon" aria-hidden>
            {Array.from({ length: n }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}
