"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOVERNORATES } from "@/lib/catalog-data";
import { shopifyImage } from "@/lib/images";
import { DELIVERY, deliveryFee, formatPrice, vatIncluded } from "@/lib/types";
import { ConfigDots } from "./CartDrawer";
import { useCart } from "./CartProvider";
import { LockIcon, PaymentMarks } from "./PaymentMarks";

/**
 * cardEnabled comes from the page, which reads it from the AmwalPay environment
 * variables. While the gateway is not configured the card option is shown but cannot be
 * chosen, so the checkout never offers a way to pay that does not exist. The server
 * agrees: checkoutSchema still accepts "cod" only, so a forged request cannot get past it.
 */
export function Checkout({ cardEnabled = false }: { cardEnabled?: boolean }) {
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<"card" | "cod">(cardEnabled ? "card" : "cod");
  const [billing, setBilling] = useState<"same" | "other">("same");

  const fee = deliveryFee(cart.subtotalCents);
  const total = cart.subtotalCents + (fee ?? 0);
  const saved = cart.savingsCents;

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
          <p className="pay-secure">
            <LockIcon /> All transactions are secure and encrypted.
          </p>

          <label className={`radio-card pay-option ${method === "card" ? "on" : ""} ${cardEnabled ? "" : "soon"}`}>
            <input
              type="radio"
              name="pay"
              value="card"
              checked={method === "card"}
              disabled={!cardEnabled}
              onChange={() => setMethod("card")}
            />
            <span>
              <strong>
                Card, Apple Pay or Bank Muscat EPP
                {!cardEnabled && <i className="soon-tag">Coming soon</i>}
              </strong>
              <small>
                {cardEnabled
                  ? "You will be taken to AmwalPay to finish paying, then brought straight back here."
                  : "We are connecting AmwalPay. Until then, please choose cash on delivery."}
              </small>
            </span>
            <PaymentMarks />
          </label>

          <label className={`radio-card pay-option ${method === "cod" ? "on" : ""}`}>
            <input type="radio" name="pay" value="cod" checked={method === "cod"} onChange={() => setMethod("cod")} />
            <span>
              <strong>Cash on delivery</strong>
              <small>Pay the driver in cash when your furniture arrives.</small>
            </span>
            <b>COD</b>
          </label>
        </fieldset>

        {/* Only a card payment needs a billing address, so it only appears for one. */}
        {method === "card" && (
          <fieldset>
            <legend>Billing address</legend>
            <label className={`radio-card pay-option ${billing === "same" ? "on" : ""}`}>
              <input type="radio" name="billing" value="same" checked={billing === "same"} onChange={() => setBilling("same")} />
              <span>
                <strong>Same as delivery address</strong>
              </span>
            </label>
            <label className={`radio-card pay-option ${billing === "other" ? "on" : ""}`}>
              <input type="radio" name="billing" value="other" checked={billing === "other"} onChange={() => setBilling("other")} />
              <span>
                <strong>Use a different billing address</strong>
              </span>
            </label>
            {billing === "other" && (
              <div className="billing-fields">
                {field("billingName", "Name on the card", { required: true, autoComplete: "cc-name" })}
                <div className="field-row">
                  <label className="field">
                    <span>Governorate</span>
                    <select name="billingGovernorate" defaultValue="Muscat">
                      {GOVERNORATES.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  {field("billingWilaya", "Wilaya / city", { required: true, autoComplete: "address-level2" })}
                </div>
                {field("billingArea", "Area, street / way number", { required: true, autoComplete: "address-line1" })}
              </div>
            )}
          </fieldset>
        )}

        <p className="hint">
          Delivered in {DELIVERY.days}, {DELIVERY.businessDays}. Returns within 15 days for unused, unassembled items —
          see our <Link href="/help#returns">returns policy</Link>.
        </p>

        {message && <p className="notice err">{message}</p>}
        <button className="btn solid wide" disabled={state === "sending"}>
          {state === "sending"
            ? method === "card"
              ? "Taking you to payment…"
              : "Placing order…"
            : `${method === "card" ? "Pay" : "Place order ·"} ${formatPrice(total)}`}
        </button>
      </form>

      <aside className="summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <ul className="sum-lines">
          {cart.lines.map((l) => {
            const was = l.compareAtCents && l.compareAtCents > l.unitPriceCents ? l.compareAtCents : null;
            return (
              <li key={l.id}>
                <span className="sum-thumb">
                  {l.image ? (
                    <img src={shopifyImage(l.image, 160)} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <i aria-hidden />
                  )}
                  {/* the count sits on the photo, as it does in the basket drawer */}
                  <b aria-hidden>{l.quantity}</b>
                </span>
                <div className="sum-info">
                  <strong>
                    {l.name}
                    <span className="sr-qty"> × {l.quantity}</span>
                  </strong>
                  {l.nameAr && (
                    <span className="sum-ar" dir="rtl" lang="ar">
                      {l.nameAr}
                    </span>
                  )}
                  <ConfigDots line={l} />
                </div>
                <span className="sum-price">
                  {formatPrice(l.unitPriceCents * l.quantity)}
                  {was && <s>{formatPrice(was * l.quantity)}</s>}
                </span>
              </li>
            );
          })}
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
        {/* Informational only. Our subtotal is already the price being charged, so this is
            what the was-prices add up to against it -- it is never subtracted from the total. */}
        {saved > 0 && (
          <p className="saved-row">
            <span>You save</span>
            <strong>{formatPrice(saved)}</strong>
          </p>
        )}
      </aside>
    </div>
  );
}
