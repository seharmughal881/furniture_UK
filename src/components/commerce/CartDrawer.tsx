"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatPrice, SHIPPING, type CartLine } from "@/lib/types";
import { useCart } from "./CartProvider";

export function ConfigDots({ line }: { line: CartLine }) {
  const { materialName, materialHex } = useCart();
  const parts = [line.config.fabric, line.config.wood, line.config.metal].filter(Boolean);
  return (
    <span className="config-dots">
      {parts.map((s) => (
        <span key={s} title={materialName(s) ?? s}>
          <i style={{ background: materialHex(s) ?? "#ccc" }} />
          {materialName(s)}
        </span>
      ))}
    </span>
  );
}

export function QtyStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="qty" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} aria-label="Increase quantity" disabled={value >= 20}>
        +
      </button>
    </div>
  );
}

export function CartDrawer() {
  const { cart, open, setOpen, setQuantity } = useCart();
  const panel = useRef<HTMLDivElement>(null);
  const free = SHIPPING.standard.freeOverCents;
  const remaining = Math.max(0, free - cart.subtotalCents);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, setOpen]);

  return (
    <div className={`drawer-root ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={() => setOpen(false)} />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping basket"
        tabIndex={-1}
        ref={panel}
        data-lenis-prevent
      >
        <div className="drawer-head">
          <h2>Your basket {cart.count > 0 && <span>({cart.count})</span>}</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close basket">
            ✕
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="drawer-empty">
            <p>Your basket is empty.</p>
            <Link href="/shop" className="btn" onClick={() => setOpen(false)}>
              Browse the collection
            </Link>
          </div>
        ) : (
          <>
            <div className="ship-meter">
              {remaining > 0 ? (
                <>
                  You&apos;re <b>{formatPrice(remaining)}</b> away from free delivery.
                </>
              ) : (
                <>You&apos;ve unlocked free standard delivery.</>
              )}
              <div className="ship-bar">
                <i style={{ width: `${Math.min(100, (cart.subtotalCents / free) * 100)}%` }} />
              </div>
            </div>
            <ul className="drawer-lines">
              {cart.lines.map((l) => (
                <li key={l.id}>
                  <div>
                    <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="line-name">
                      {l.name}
                    </Link>
                    <ConfigDots line={l} />
                    <small>Made to order · ships in {l.leadTimeWeeks} weeks</small>
                  </div>
                  <div className="line-right">
                    <strong>{formatPrice(l.unitPriceCents * l.quantity)}</strong>
                    <QtyStepper value={l.quantity} label={l.name} onChange={(q) => setQuantity(l.id, q)} />
                    <button className="link-btn" onClick={() => setQuantity(l.id, 0)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer-foot">
              <div className="row">
                <span>Subtotal</span>
                <strong>{formatPrice(cart.subtotalCents)}</strong>
              </div>
              <p className="hint">
                Prices include VAT. Delivery {SHIPPING.standard.cents ? `${formatPrice(SHIPPING.standard.cents)}, ` : ""}free over{" "}
                {formatPrice(SHIPPING.standard.freeOverCents)} to any UK address.
              </p>
              <Link href="/checkout" className="btn solid wide" onClick={() => setOpen(false)}>
                Checkout →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
