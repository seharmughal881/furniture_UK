"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrice, SHIPPING, shippingCost, vatIncluded, type ShippingMethod } from "@/lib/types";
import { ConfigDots } from "./CartDrawer";
import { useCart } from "./CartProvider";

export function Checkout() {
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const shipping = shippingCost(method, cart.subtotalCents);
  const total = cart.subtotalCents + shipping;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = Object.fromEntries(fd);
    setState("sending");
    setErrors(null);
    setMessage(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, acceptTerms: fd.get("acceptTerms") === "on", shippingMethod: method }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      await refresh();
      router.push(`/order/${body.order.id}`);
      return;
    }
    setState("idle");
    if (body?.issues) setErrors(body.issues);
    else setMessage(body?.error ?? "Something went wrong. Please try again.");
  }

  if (cart.lines.length === 0) {
    return (
      <div className="empty">
        <h1>Your basket is empty</h1>
        <p>Add a piece from the collection to check out.</p>
        <Link href="/shop" className="btn">
          Shop furniture
        </Link>
      </div>
    );
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field ${errors?.[name] ? "invalid" : ""}`}>
      <span>{label}</span>
      <input name={name} aria-invalid={!!errors?.[name]} {...props} />
      {errors?.[name] && <em>{errors[name][0]}</em>}
    </label>
  );

  return (
    <div className="checkout">
      <form className="checkout-form" onSubmit={submit}>
        <h1>Checkout</h1>
        <p className="demo-banner" role="note">
          Demo store — no payment is taken. Your order is saved so the studio can confirm it with you.
        </p>

        <fieldset>
          <legend>Contact</legend>
          {field("email", "Email", { type: "email", required: true, autoComplete: "email" })}
          {field("phone", "Mobile or phone (to book your delivery slot)", {
            type: "tel",
            autoComplete: "tel",
            placeholder: "07700 900123",
          })}
        </fieldset>

        <fieldset>
          <legend>Delivery address</legend>
          {field("name", "Full name", { required: true, autoComplete: "name" })}
          {field("address", "Address line 1", { required: true, autoComplete: "address-line1" })}
          {field("address2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
          <div className="field-row">
            {field("city", "Town or city", { required: true, autoComplete: "address-level2" })}
            {field("county", "County (optional)", { autoComplete: "address-level1" })}
          </div>
          <div className="field-row">
            {field("postcode", "Postcode", {
              required: true,
              autoComplete: "postal-code",
              placeholder: "SW1A 1AA",
              style: { textTransform: "uppercase" },
            })}
            <label className="field">
              <span>Country</span>
              <input value="United Kingdom" readOnly aria-readonly />
            </label>
          </div>
          <p className="hint">We deliver to every UK address — including the Highlands, islands and Northern Ireland — at the same price.</p>
        </fieldset>

        <fieldset>
          <legend>Delivery method</legend>
          {(Object.keys(SHIPPING) as ShippingMethod[]).map((m) => {
            const cost = shippingCost(m, cart.subtotalCents);
            return (
              <label key={m} className={`radio-card ${method === m ? "on" : ""}`}>
                <input type="radio" name="ship" checked={method === m} onChange={() => setMethod(m)} />
                <span>
                  <strong>{SHIPPING[m].label}</strong>
                  <small>{SHIPPING[m].note}</small>
                </span>
                <b>{cost === 0 ? "Free" : formatPrice(cost)}</b>
              </label>
            );
          })}
        </fieldset>

        <div className="rights">
          <p>
            <b>Your right to cancel:</b> you can cancel within 14 days of delivery for any reason and get a full refund
            (Consumer Contracts Regulations 2013). Our <Link href="/help#returns">100-night home trial</Link> gives you
            longer. This does not affect your statutory rights.
          </p>
          <label className={`check ${errors?.acceptTerms ? "invalid" : ""}`}>
            <input type="checkbox" name="acceptTerms" required />
            <span>
              I have read the <Link href="/legal#terms">terms of sale</Link> and{" "}
              <Link href="/legal#privacy">privacy notice</Link>.
            </span>
          </label>
          {errors?.acceptTerms && <em className="field-error">{errors.acceptTerms[0]}</em>}
        </div>

        {message && <p className="notice err">{message}</p>}
        {/* Consumer Contracts Regulations 2013, reg. 14(4): the button must make the obligation to pay explicit */}
        <button className="btn solid wide" disabled={state === "sending"}>
          {state === "sending" ? "Placing order…" : `Order with obligation to pay · ${formatPrice(total, true)}`}
        </button>
      </form>

      <aside className="summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <ul>
          {cart.lines.map((l) => (
            <li key={l.id}>
              <div>
                <strong>
                  {l.name} <span>× {l.quantity}</span>
                </strong>
                <ConfigDots line={l} />
              </div>
              <span>{formatPrice(l.unitPriceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="row">
          <span>Subtotal</span>
          <span>{formatPrice(cart.subtotalCents, true)}</span>
        </div>
        <div className="row">
          <span>Delivery</span>
          <span>{shipping === 0 ? "Free" : formatPrice(shipping, true)}</span>
        </div>
        <div className="row total-row">
          <span>Total</span>
          <strong>{formatPrice(total, true)}</strong>
        </div>
        <div className="row vat-row">
          <span>Includes VAT at 20%</span>
          <span>{formatPrice(vatIncluded(total), true)}</span>
        </div>
      </aside>
    </div>
  );
}
