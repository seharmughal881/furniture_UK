"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GOVERNORATES } from "@/lib/catalog-data";
import { describeQuote } from "@/lib/shipping";
import { formatPrice } from "@/lib/types";
import { useCart } from "./CartProvider";

/**
 * The basket's three tools: leave a note, estimate delivery, redeem a code.
 *
 * One panel is open at a time. They are collapsed by default because the basket's job is
 * to get someone to the checkout, and three open forms between the products and the
 * button is a worse basket than one row of three small controls.
 */

type Tool = "note" | "shipping" | "coupon" | null;

const MAX_NOTE = 500;

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
      <path d="M14.5 7.5 16.5 9.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 7.5h11v8H2zM13 10h4l3 3v2.5h-7z" strokeLinejoin="round" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 11.5V4h7.5L21 14.5 14.5 21 4 10.5Z" strokeLinejoin="round" />
      <circle cx="7.6" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CartTools() {
  const { cart, setNote, setGovernorate, applyCoupon, removeCoupon } = useCart();
  const [tool, setTool] = useState<Tool>(null);
  const panelId = useId();

  const toggle = (t: Exclude<Tool, null>) => setTool((cur) => (cur === t ? null : t));

  return (
    <div className="cart-tools">
      <div className="tool-tabs" role="group" aria-label="Basket options">
        <button
          type="button"
          className={tool === "note" ? "on" : ""}
          aria-expanded={tool === "note"}
          aria-controls={`${panelId}-note`}
          onClick={() => toggle("note")}
        >
          <NoteIcon />
          Note
          {cart.note && <i className="tool-dot" aria-label="A note is saved" />}
        </button>
        <button
          type="button"
          className={tool === "shipping" ? "on" : ""}
          aria-expanded={tool === "shipping"}
          aria-controls={`${panelId}-shipping`}
          onClick={() => toggle("shipping")}
        >
          <TruckIcon />
          Shipping
          {cart.shipGovernorate && <i className="tool-dot" aria-label="A governorate is chosen" />}
        </button>
        <button
          type="button"
          className={tool === "coupon" ? "on" : ""}
          aria-expanded={tool === "coupon"}
          aria-controls={`${panelId}-coupon`}
          onClick={() => toggle("coupon")}
        >
          <TagIcon />
          Coupon
          {cart.coupon && <i className="tool-dot" aria-label="A code is applied" />}
        </button>
      </div>

      {tool === "note" && <NotePanel id={`${panelId}-note`} value={cart.note} onSave={setNote} />}
      {tool === "shipping" && (
        <ShippingPanel id={`${panelId}-shipping`} chosen={cart.shipGovernorate} onChoose={setGovernorate} />
      )}
      {tool === "coupon" && (
        <CouponPanel id={`${panelId}-coupon`} onApply={applyCoupon} onRemove={removeCoupon} applied={cart.coupon?.code ?? null} />
      )}
    </div>
  );
}

function NotePanel({ id, value, onSave }: { id: string; value: string; onSave: (v: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  // A saved confirmation that never goes away reads as a permanent label rather than as
  // feedback about what just happened.
  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  async function save() {
    if (draft === value) return setState("saved");
    setState("saving");
    setState((await onSave(draft)) ? "saved" : "error");
  }

  const left = MAX_NOTE - draft.length;

  return (
    <div className="tool-panel" id={id}>
      <label className="field">
        <span>Add a note to your order</span>
        <textarea
          ref={box}
          rows={3}
          value={draft}
          maxLength={MAX_NOTE}
          placeholder="e.g. Please call before 6pm — the blue gate on the left"
          onChange={(e) => setDraft(e.target.value)}
          // Saving on blur as well as on the button means a shopper who types a note and
          // goes straight to Checkout does not lose it.
          onBlur={save}
        />
      </label>
      <div className="tool-row">
        <small className={left < 50 ? "warn" : ""}>{left} characters left</small>
        <button type="button" className="btn small" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save note"}
        </button>
      </div>
      <p aria-live="polite" className="tool-msg">
        {state === "saved" && "Note saved — our team will see it with your order."}
        {state === "error" && <span className="err">We couldn&apos;t save that note. Please try again.</span>}
      </p>
    </div>
  );
}

function ShippingPanel({ id, chosen, onChoose }: { id: string; chosen: string; onChoose: (g: string) => Promise<void> }) {
  const { cart } = useCart();
  const [busy, setBusy] = useState(false);
  const quote = cart.shipping;

  async function choose(g: string) {
    setBusy(true);
    await onChoose(g);
    setBusy(false);
  }

  return (
    <div className="tool-panel" id={id}>
      <label className="field">
        <span>Estimate delivery</span>
        <select value={chosen} disabled={busy} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose your governorate…</option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      {quote && (
        <dl className="tool-quote">
          <div>
            <dt>Delivery</dt>
            <dd>{describeQuote(quote, formatPrice)}</dd>
          </div>
          <div>
            <dt>Arrives in</dt>
            <dd>{quote.days}</dd>
          </div>
        </dl>
      )}
      {quote?.available && quote.remainingForFreeCents > 0 && (
        <p className="tool-msg">
          Spend <b>{formatPrice(quote.remainingForFreeCents)}</b> more for free delivery
          {chosen ? ` to ${chosen}` : ""}.
        </p>
      )}
      {quote && !quote.available && (
        <p className="tool-msg">
          <span className="err">We don&apos;t deliver here yet — please call us and we&apos;ll arrange it.</span>
        </p>
      )}
    </div>
  );
}

function CouponPanel({
  id,
  applied,
  onApply,
  onRemove,
}: {
  id: string;
  applied: string | null;
  onApply: (code: string) => Promise<string | null>;
  onRemove: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!applied) box.current?.focus();
  }, [applied]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const message = await onApply(code);
    setBusy(false);
    if (message) setError(message);
    else setCode("");
  }

  if (applied) {
    return (
      <div className="tool-panel" id={id}>
        <p className="coupon-applied">
          <b>{applied}</b> applied
          <button
            type="button"
            className="link-btn"
            onClick={async () => {
              setBusy(true);
              await onRemove();
              setBusy(false);
            }}
            disabled={busy}
          >
            Remove
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="tool-panel" id={id} onSubmit={submit}>
      <label className="field">
        <span>Discount code</span>
        <div className="tool-row">
          <input
            ref={box}
            value={code}
            maxLength={40}
            // Codes are matched case-insensitively on the server; showing them upper-cased
            // just makes a typed code look like the one printed on the flyer.
            style={{ textTransform: "uppercase" }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Enter code"
            aria-invalid={!!error}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
          />
          <button className="btn small" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : "Apply"}
          </button>
        </div>
      </label>
      <p aria-live="polite" className="tool-msg">
        {error && <span className="err">{error}</span>}
      </p>
    </form>
  );
}
