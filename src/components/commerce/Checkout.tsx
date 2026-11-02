"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOVERNORATES } from "@/lib/catalog-data";
import { DELIVERY, deliveryFee, formatPrice, vatIncluded } from "@/lib/types";
import { ConfigDots } from "./CartDrawer";
import { useCart } from "./CartProvider";

export function Checkout() {
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fee = deliveryFee(cart.subtotalCents);
  const total = cart.subtotalCents + (fee ?? 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setState("sending");
    setErrors(null);
    setMessage(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, paymentMethod: "cod" }),
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
        <p>Add a product to check out.</p>
        <Link href="/shop" className="btn">
          Shop now
        </Link>
      </div>
    );
  }

  const err = (name: string) => errors?.[name] && <em>{errors[name][0]}</em>;
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field ${errors?.[name] ? "invalid" : ""}`}>
      <span>{label}</span>
      <input name={name} aria-invalid={!!errors?.[name]} {...props} />
      {err(name)}
    </label>
  );

  return (
    <div className="checkout">
      <form className="checkout-form" onSubmit={submit}>
        <ol className="steps-bar" aria-label="Checkout progress">
          <li className="done">Basket</li>
          <li className="on" aria-current="step">
            Details
          </li>
          <li>Confirmed</li>
        </ol>
        <h1>Checkout</h1>

        <fieldset>
          <legend>Your details</legend>
          {field("name", "Full name", { required: true, autoComplete: "name" })}
          <div className="field-row">
            {field("phone", "Mobile number", {
              required: true,
              type: "tel",
              autoComplete: "tel",
              placeholder: "9123 4567",
              inputMode: "tel",
            })}
            {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
          </div>
          <p className="hint">We call or WhatsApp this number to confirm your order and book delivery.</p>
        </fieldset>

        <fieldset>
          <legend>Delivery address in Oman</legend>
          <div className="field-row">
            <label className={`field ${errors?.governorate ? "invalid" : ""}`}>
              <span>Governorate</span>
              <select name="governorate" required defaultValue="Muscat">
                {GOVERNORATES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              {err("governorate")}
            </label>
            {field("wilaya", "Wilaya / city", { required: true, placeholder: "e.g. Bawshar", autoComplete: "address-level2" })}
          </div>
          {field("area", "Area, street / way number", {
            required: true,
            placeholder: "e.g. Al Khuwair, Way 3021",
            autoComplete: "address-line1",
          })}
          {field("building", "Building / house number and flat (optional)", { autoComplete: "address-line2" })}
          {field("landmark", "Nearest landmark (optional)", { placeholder: "e.g. behind Lulu Hypermarket" })}
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <label className="radio-card on">
            <input type="radio" name="pay" defaultChecked />
            <span>
              <strong>Cash on delivery</strong>
              <small>Pay in cash when your furniture arrives</small>
            </span>
            <b>COD</b>
          </label>
          <p className="hint">Card payment will be added when the payment gateway is connected.</p>
        </fieldset>

        <p className="hint">
          Delivered in {DELIVERY.days}, {DELIVERY.businessDays}. Returns within 15 days for unused, unassembled items —
          see our <Link href="/help#returns">returns policy</Link>.
        </p>

        {message && <p className="notice err">{message}</p>}
        <button className="btn solid wide" disabled={state === "sending"}>
          {state === "sending" ? "Placing order…" : `Place order · ${formatPrice(total)}`}
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
          <span>{formatPrice(cart.subtotalCents)}</span>
        </div>
        <div className="row">
          <span>Delivery</span>
          <span>{fee === 0 ? "Free" : "Confirmed by phone"}</span>
        </div>
        {fee === null && (
          <p className="hint">
            Add {formatPrice(DELIVERY.freeOverCents - cart.subtotalCents)} more for free delivery. Otherwise the fee
            depends on size and location — we tell you before dispatch.
          </p>
        )}
        <div className="row total-row">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <div className="row vat-row">
          <span>Includes VAT at 5%</span>
          <span>{formatPrice(vatIncluded(total))}</span>
        </div>
      </aside>
    </div>
  );
}
