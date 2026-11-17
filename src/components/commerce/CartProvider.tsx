"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { orderTotals } from "@/lib/pricing";
import { cartSavings, EMPTY_CART, type Cart, type Material } from "@/lib/types";

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
  /** Save (or clear, with "") the customer's note on the basket. */
  setNote: (note: string) => Promise<boolean>;
  /** Pick the governorate the delivery estimate is for; "" returns to nationwide terms. */
  setGovernorate: (governorate: string) => Promise<void>;
  /** Try a discount code. Resolves to an error message, or null when it was accepted. */
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;
  materialName: (slug: string) => string | null;
  materialHex: (slug: string) => string | null;
};

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
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
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
      .then((r) => (r.ok ? r.json() : EMPTY_CART))
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
      const subtotalCents = lines.reduce((n, l) => n + l.quantity * l.unitPriceCents, 0);
      /*
       * The discount is carried over and re-clamped rather than recomputed, because the
       * browser is not told a coupon's percentage or its rules -- only what it is worth
       * right now. orderTotals() does the clamping, so a basket shrunk below a fixed-amount
       * code cannot flash a negative total in the half-second before the server replies.
       *
       * The server's answer lands immediately after and is authoritative: a coupon that
       * has stopped qualifying disappears then, which is the only place that decision is
       * ever made.
       */
      const totals = orderTotals({
        subtotalCents,
        discountCents: c.coupon?.discountCents ?? 0,
        shippingCents: c.shipping?.feeCents ?? null,
      });
      return {
        ...c,
        lines,
        count: lines.reduce((n, l) => n + l.quantity, 0),
        subtotalCents,
        savingsCents: cartSavings(lines),
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        deliveryTbc: totals.deliveryTbc,
      };
    });
    const res = await fetch(`/api/cart/items/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }).catch(() => null);
    if (res?.ok) setCart(await res.json());
  }, []);

  /**
   * One shape for the three new basket actions.
   *
   * Each returns the whole basket, so the discount, the delivery quote and the totals
   * always arrive together and already agreed with each other. Reconstructing them
   * piecemeal in the browser is what lets a cart drawer show a total the checkout then
   * contradicts.
   */
  const patch = useCallback(async (path: string, method: string, body?: unknown) => {
    const res = await fetch(`/api/cart/${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data) setCart(data);
    // A rejected coupon still returns the basket as it stands, so the drawer can show the
    // unchanged totals beside the error instead of going blank.
    else if (data?.cart) setCart(data.cart);
    return { ok: !!res?.ok, error: typeof data?.error === "string" ? data.error : null };
  }, []);

  const setNote = useCallback(async (note: string) => (await patch("note", "PUT", { note })).ok, [patch]);

  const setGovernorate = useCallback(
    async (governorate: string) => {
      await patch("shipping", "PUT", { governorate });
    },
    [patch],
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      const r = await patch("coupon", "POST", { code });
      return r.ok ? null : (r.error ?? "We couldn't apply that code. Please try again.");
    },
    [patch],
  );

  const removeCoupon = useCallback(async () => {
    await patch("coupon", "DELETE");
  }, [patch]);

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
      setNote,
      setGovernorate,
      applyCoupon,
      removeCoupon,
      materialName: (s) => bySlug.get(s)?.name ?? null,
      materialHex: (s) => bySlug.get(s)?.hex ?? null,
    };
  }, [cart, open, busy, error, add, setQuantity, refresh, setNote, setGovernorate, applyCoupon, removeCoupon, materials]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside <CartProvider>");
  return c;
}
