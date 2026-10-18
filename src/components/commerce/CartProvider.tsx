"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cart, Material } from "@/lib/types";

export type AddItem = { productSlug: string; quantity: number; config: { fabric: string; wood: string; metal: string } };

type CartCtx = {
  cart: Cart;
  open: boolean;
  setOpen: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  add: (items: AddItem[]) => Promise<boolean>;
  setQuantity: (lineId: number, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
  materialName: (slug: string) => string | null;
  materialHex: (slug: string) => string | null;
};

const EMPTY: Cart = { lines: [], count: 0, subtotalCents: 0 };
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

  const add = useCallback(async (items: AddItem[]) => {
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
