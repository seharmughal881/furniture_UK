"use client";

import { useState } from "react";

/**
 * The product's options (colour, size…), which the storefront reads out of
 * products.variants and prices a basket line by.
 *
 * Prices stay as the text the owner typed and are parsed on the server by the same
 * helpers as the main price (see productVariantSchema), so this component never does
 * money arithmetic and the two can never disagree about what "475.000" means.
 *
 * Rows live in React state and are mirrored into one hidden input as JSON, the same
 * arrangement as ImageManager.
 */

export type VariantDraft = {
  title: string;
  price: string;
  compareAt: string;
  available: boolean;
};

const MAX_VARIANTS = 40;

const blank = (): VariantDraft => ({ title: "", price: "", compareAt: "", available: true });

export function VariantEditor({
  name,
  initial,
  canEditPrices,
}: {
  name: string;
  initial: VariantDraft[];
  canEditPrices: boolean;
}) {
  const [rows, setRows] = useState<VariantDraft[]>(initial);

  const patch = (i: number, change: Partial<VariantDraft>) =>
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...change } : r)));

  return (
    <div className="adm-variants">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      {rows.length === 0 ? (
        <p className="adm-stat-note">
          No options. The product is sold at its single price above.
        </p>
      ) : (
        <table className="adm-table adm-variant-table">
          <thead>
            <tr>
              <th>Option name</th>
              <th>Price (OMR)</th>
              <th>Was (OMR)</th>
              <th>In stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={row.title}
                    onChange={(e) => patch(i, { title: e.target.value })}
                    placeholder="e.g. Grey"
                    aria-label={`Option ${i + 1} name`}
                    maxLength={120}
                  />
                </td>
                <td>
                  <input
                    value={row.price}
                    onChange={(e) => patch(i, { price: e.target.value })}
                    placeholder="475.000"
                    inputMode="decimal"
                    aria-label={`Option ${i + 1} price`}
                    readOnly={!canEditPrices}
                  />
                </td>
                <td>
                  <input
                    value={row.compareAt}
                    onChange={(e) => patch(i, { compareAt: e.target.value })}
                    placeholder="—"
                    inputMode="decimal"
                    aria-label={`Option ${i + 1} was-price`}
                    readOnly={!canEditPrices}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.available}
                    onChange={(e) => patch(i, { available: e.target.checked })}
                    aria-label={`Option ${i + 1} in stock`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="adm-btn adm-btn-quiet"
                    onClick={() => setRows((prev) => prev.filter((_, n) => n !== i))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.length < MAX_VARIANTS && (
        <button type="button" className="adm-btn" onClick={() => setRows((prev) => [...prev, blank()])}>
          Add an option
        </button>
      )}
      {!canEditPrices && rows.length > 0 && (
        <p className="adm-stat-note">Only a manager can change option prices.</p>
      )}
    </div>
  );
}
