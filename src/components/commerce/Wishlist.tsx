"use client";

import { useCallback, useSyncExternalStore } from "react";

// Wishlist and "recently viewed" live in this browser only (no account needed).
const EVENT = "mf-lists";

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* private mode / storage full: the list just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

// useSyncExternalStore needs a stable snapshot: cache the parsed list per raw string.
const cache = new Map<string, { raw: string; list: string[] }>();
function useList(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      let raw = "[]";
      try {
        raw = localStorage.getItem(key) ?? "[]";
      } catch {}
      const hit = cache.get(key);
      if (hit && hit.raw === raw) return hit.list;
      const list = read(key);
      cache.set(key, { raw, list });
      return list;
    },
    () => EMPTY,
  );
}
const EMPTY: string[] = [];

export function useWishlist() {
  const list = useList("mf-wishlist");
  const toggle = useCallback((slug: string) => {
    const cur = read("mf-wishlist");
    write("mf-wishlist", cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur].slice(0, 100));
  }, []);
  return { list, has: (slug: string) => list.includes(slug), toggle };
}

export function useRecentlyViewed() {
  const list = useList("mf-recent");
  const push = useCallback((slug: string) => {
    write("mf-recent", [slug, ...read("mf-recent").filter((s) => s !== slug)].slice(0, 12));
  }, []);
  return { list, push };
}

export function HeartButton({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const on = has(slug);
  return (
    <button
      type="button"
      className={`heart-btn ${on ? "on" : ""} ${className}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.1C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.7 1.2-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.9-1.8 4.5-9.3 9.1-9.3 9.1Z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    </button>
  );
}
