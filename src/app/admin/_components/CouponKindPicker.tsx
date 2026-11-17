"use client";

import { useState } from "react";

/**
 * The kind of discount, and the one value box that goes with it.
 *
 * Showing all three value inputs at once is how an owner ends up creating a "20% off"
 * code that is actually OMR 20 off. Only the relevant box is rendered, so there is
 * nothing to fill in by mistake, and couponFormSchema reads only the field that matches
 * the chosen kind anyway.
 */
export function CouponKindPicker() {
  const [kind, setKind] = useState<"percent" | "fixed" | "free_shipping">("percent");

  return (
    <>
      <label className="adm-field">
        <span>Kind</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="percent">Percentage off</option>
          <option value="fixed">Amount off</option>
          <option value="free_shipping">Free delivery</option>
        </select>
      </label>

      {kind === "percent" && (
        <div className="adm-field-row">
          <label className="adm-field">
            <span>Percentage</span>
            <input name="percent" inputMode="numeric" placeholder="10" defaultValue="10" autoComplete="off" />
            <small>A whole number between 1 and 100.</small>
          </label>
          <label className="adm-field">
            <span>Maximum discount (optional)</span>
            <input name="maxDiscount" inputMode="decimal" placeholder="25.000" autoComplete="off" />
            <small>In rials. Worth setting: 10% off a bedroom set is a lot of money.</small>
          </label>
        </div>
      )}

      {kind === "fixed" && (
        <label className="adm-field">
          <span>Amount off</span>
          <input name="amount" inputMode="decimal" placeholder="5.000" autoComplete="off" />
          <small>In rials, like every other price in the panel.</small>
        </label>
      )}

      {kind === "free_shipping" && (
        <p className="adm-sub">
          Delivery becomes free for any basket this code is used on, whatever the governorate and whatever the
          basket is worth.
        </p>
      )}
    </>
  );
}
