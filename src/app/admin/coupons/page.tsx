import { listCoupons } from "@/lib/admin/coupons";
import { formatPrice } from "@/lib/types";
import { couponAction, createCouponAction } from "../actions";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { CouponKindPicker } from "../_components/CouponKindPicker";

export const metadata = { title: "Discount codes", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function describe(c: Awaited<ReturnType<typeof listCoupons>>[number]): string {
  if (c.kind === "free_shipping") return "Free delivery";
  if (c.kind === "percent") {
    return `${c.value}% off${c.maxDiscountCents ? `, up to ${formatPrice(c.maxDiscountCents)}` : ""}`;
  }
  return `${formatPrice(c.value)} off`;
}

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const sp = await searchParams;
  const error = one(sp.error);
  const coupons = await listCoupons();

  const live = coupons.filter((c) => c.active && !c.finished).length;
  const given = coupons.reduce((n, c) => n + c.givenCents, 0);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Discount codes</h1>
          <p className="adm-sub">
            {live} live · {coupons.length} in total · {formatPrice(given)} given away so far
          </p>
        </div>
      </div>

      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}

      <p className="adm-note">
        A code is checked again when the order is placed, not only when the shopper types it. If you switch one off,
        it stops working on the next click — including for a basket that already has it applied.
      </p>

      <section className="adm-card">
        <h2>Create a code</h2>
        <form action={createCouponAction} className="adm-form coupon-form">
          <label className="adm-field">
            <span>Code</span>
            <input name="code" required maxLength={32} placeholder="EID25" autoCapitalize="characters" autoComplete="off" />
            <small>Letters, numbers, hyphens. Shoppers can type it in any case.</small>
          </label>

          {/* Which value box is relevant depends on the kind, so the picker hides the
              other one. It is the only interactive piece on this page. */}
          <CouponKindPicker />

          <label className="adm-field">
            <span>Minimum spend (optional)</span>
            <input name="minSubtotal" inputMode="decimal" placeholder="75.000" autoComplete="off" />
            <small>In rials. Leave blank for no minimum.</small>
          </label>

          <div className="adm-field-row">
            <label className="adm-field">
              <span>Starts (optional)</span>
              <input type="datetime-local" name="startsAt" />
            </label>
            <label className="adm-field">
              <span>Ends (optional)</span>
              <input type="datetime-local" name="endsAt" />
            </label>
          </div>
          <small className="adm-sub">Both are Oman time.</small>

          <div className="adm-field-row">
            <label className="adm-field">
              <span>Total uses (optional)</span>
              <input name="maxRedemptions" inputMode="numeric" placeholder="100" autoComplete="off" />
              <small>Leave blank for unlimited.</small>
            </label>
            <label className="adm-field adm-check">
              <input type="checkbox" name="oncePerCustomer" />
              <span>One use per phone number</span>
            </label>
          </div>

          <label className="adm-field">
            <span>Internal note (optional)</span>
            <input name="note" maxLength={200} placeholder="National Day campaign" autoComplete="off" />
            <small>Only ever shown here, never to customers.</small>
          </label>

          <button className="adm-btn adm-btn-primary">Create code</button>
        </form>
      </section>

      <div className="adm-table-wrap">
        {coupons.length === 0 ? (
          <p className="adm-empty">No discount codes yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Conditions</th>
                <th>Used</th>
                <th>Given</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className={c.active && !c.finished ? "" : "adm-row-off"}>
                  <td>
                    <strong className="adm-num">{c.code}</strong>
                    {c.note && <div className="adm-sub">{c.note}</div>}
                    {!c.active && <div className="adm-sub">Switched off</div>}
                    {c.active && c.finished && <div className="adm-sub">Finished</div>}
                  </td>
                  <td>{describe(c)}</td>
                  <td className="adm-sub">
                    {c.minSubtotalCents > 0 && <div>Spend {formatPrice(c.minSubtotalCents)}+</div>}
                    {c.startsAt && <div>From {c.startsAt}</div>}
                    {c.endsAt && <div>Until {c.endsAt}</div>}
                    {c.oncePerCustomer && <div>One per customer</div>}
                    {c.minSubtotalCents === 0 && !c.startsAt && !c.endsAt && !c.oncePerCustomer && <div>None</div>}
                  </td>
                  <td className="adm-num">
                    {c.redemptions}
                    {c.maxRedemptions !== null && ` / ${c.maxRedemptions}`}
                  </td>
                  <td className="adm-num">{formatPrice(c.givenCents)}</td>
                  <td>
                    <div className="adm-row-actions">
                      <form action={couponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="what" value={c.active ? "disable" : "enable"} />
                        <button className="adm-btn adm-btn-quiet">{c.active ? "Switch off" : "Switch on"}</button>
                      </form>
                      {/* Only ever offered for a code nobody has used: deleting one that
                          has been redeemed would cascade away the record of discounts
                          already given. deleteCoupon() refuses it server-side too. */}
                      {c.redemptions === 0 && (
                        <form action={couponAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="what" value="delete" />
                          <ConfirmSubmit
                            label="Delete"
                            confirmLabel="Delete it"
                            question={`Delete ${c.code}?`}
                          />
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
