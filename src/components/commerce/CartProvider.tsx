"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cartSavings, type Cart, type Material } from "@/lib/types";

export type AddItem = {
  productSlug: string;
  quantity: number;
  /** chosen product option, e.g. a colour or size ("" when the product has none) */
  variant?: string;
  config: { fabric: string; wood: string; metal: string };
};

type CartCtx = {
  cart: Cart;
  open: boolean;
  setOpen: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  add: (items: AddItem[], fx?: FlyFrom) => Promise<boolean>;
  setQuantity: (lineId: number, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
  materialName: (slug: string) => string | null;
  materialHex: (slug: string) => string | null;
};

const EMPTY: Cart = { lines: [], count: 0, subtotalCents: 0, savingsCents: 0 };

type FlyFrom = { from?: Element | null; image?: string | null };

/** A product thumbnail flies from the button to the basket, then the basket bumps. */
function flyToBasket({ from, image }: FlyFrom) {
  const target = document.querySelector(".cart-btn");
  if (!from || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement(image ? "img" : "span");
  dot.className = "fly-dot";
  if (image && dot instanceof HTMLImageElement) dot.src = image; // an already-loaded URL, so it shows instantly
  dot.style.left = `${a.left + a.width / 2 - 28}px`;
  dot.style.top = `${a.top + a.height / 2 - 28}px`;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  dot
    .animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(0.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 },
      ],
      { duration: 750, easing: "cubic-bezier(0.5, 0, 0.2, 1)" },
    )
    .finished.then(() => {
      dot.remove();
      target.classList.remove("bump");
      void (target as HTMLElement).offsetWidth; // restart the animation
      target.classList.add("bump");
    });
  return true;
}
const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ materials, children }: { materials: Material[]; children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cart", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setCart(await res.json());
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/cart", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((c) => alive && setCart(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback(async (items: AddItem[], fx?: FlyFrom) => {
    const flying = fx ? flyToBasket(fx) : false;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("We couldn't add that to your basket. Please try again.");
      return false;
    }
    setCart(await res.json());
    // let the thumbnail land on the basket before the drawer slides over it
    if (flying) await new Promise((r) => setTimeout(r, 650));
    setOpen(true);
    return true;
  }, []);

  const setQuantity = useCallback(async (lineId: number, quantity: number) => {
    // optimistic update, then reconcile with the server
    setCart((c) => {
      const lines = c.lines.map((l) => (l.id === lineId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0);
      return {
        lines,
        count: lines.reduce((n, l) => n + l.quantity, 0),
        subtotalCents: lines.reduce((n, l) => n + l.quantity * l.unitPriceCents, 0),
        savingsCents: cartSavings(lines),
      };
    });
    const res = await fetch(`/api/cart/items/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }).catch(() => null);
    if (res?.ok) setCart(await res.json());
  }, []);

  const value = useMemo<CartCtx>(() => {
    const bySlug = new Map(materials.map((m) => [m.slug, m]));
    return {
      cart,
      open,
      setOpen,
      busy,
      error,
      add,
      setQuantity,
      refresh,
      materialName: (s) => bySlug.get(s)?.name ?? null,
      materialHex: (s) => bySlug.get(s)?.hex ?? null,
    };
  }, [cart, open, busy, error, add, setQuantity, refresh, materials]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside <CartProvider>");
  return c;
}
