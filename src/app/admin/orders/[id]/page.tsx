import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/admin/orders";
import { NEXT_STATUSES, STATUS_LABEL, TRANSITION_LABEL } from "@/lib/admin/status";
import { whatsappLink } from "@/lib/company";
import { formatPrice } from "@/lib/types";
import { addNoteAction, setStatusAction } from "../../actions";
import { OrderAddress } from "../../_components/OrderAddress";
import { StatusBadge } from "../../_components/StatusBadge";

export const metadata = { title: "Order", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrderDetailPage({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const error = one((await searchParams).error);

  const order = await getOrder(id);
  if (!order) notFound();

  const number = `#${String(order.number).padStart(5, "0")}`;
  const nextStatuses = NEXT_STATUSES[order.status];
  const units = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <>
      <div className="adm-head">
        <div>
          <p className="adm-sub">
            <Link href="/admin/orders">← All orders</Link>
          </p>
          <h1>
            Order {number} <StatusBadge status={order.status} />
          </h1>
          <p className="adm-sub">Placed {order.createdAt}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="adm-btn" href={whatsappLink(`Hello ${order.name}, about your Muscat Furniture order ${number}:`)} target="_blank" rel="noopener noreferrer">
            WhatsApp customer
          </a>
          <Link className="adm-btn" href={`/admin/orders/${order.id}/print`}>
            Delivery note
          </Link>
        </div>
      </div>

      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}

      {order.feeTbc && (
        <p className="adm-tbc" style={{ marginBottom: 20 }}>
          <strong>Delivery fee still to confirm.</strong> This order is under the free-delivery
          threshold, so the fee depends on size and destination — agree it with the customer by phone
          before dispatch. The total below does not include it yet.
        </p>
      )}

      <div className="adm-detail">
        <div className="adm-stack">
          <section className="adm-card">
            <h2>
              Items <span className="adm-sub" style={{ fontWeight: 400 }}>· {order.items.length} line(s), {units} unit(s)</span>
            </h2>
            <div className="adm-table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Options</th>
                    <th>Qty</th>
                    <th className="adm-money">Unit</th>
                    <th className="adm-money">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => {
                    const options = Object.entries(item.config ?? {})
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ");
                    return (
                      <tr key={i}>
                        <td dir="auto" style={{ whiteSpace: "normal" }}>{item.name}</td>
                        <td className="adm-sub" style={{ whiteSpace: "normal" }}>{options || "—"}</td>
                        <td>{item.qty}</td>
                        <td className="adm-money">{formatPrice(item.price)}</td>
                        <td className="adm-money">{formatPrice(item.price * item.qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="adm-totals">
              <div className="adm-total-row">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotalCents)}</span>
              </div>
              <div className="adm-total-row">
                <span>Delivery</span>
                <span>{order.feeTbc ? "To confirm by phone" : order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)}</span>
              </div>
              <div className="adm-total-row grand">
                <span>Total to collect</span>
                <span>{formatPrice(order.totalCents)}</span>
              </div>
              <div className="adm-total-row adm-sub">
                <span>Includes VAT at 5%</span>
                <span>{formatPrice(order.vatCents)}</span>
              </div>
            </div>
          </section>

          <section className="adm-card">
            <h2>Move this order on</h2>
            {nextStatuses.length === 0 ? (
              <p className="adm-pad adm-sub">
                {STATUS_LABEL[order.status]} is the end of the line — there is nothing further to do.
              </p>
            ) : (
              <div className="adm-actions">
                {nextStatuses.map((to) => (
                  <form key={to} action={setStatusAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="to" value={to} />
                    <button
                      type="submit"
                      className={`adm-btn ${to === "cancelled" ? "adm-btn-danger" : "adm-btn-primary"}`}
                    >
                      {TRANSITION_LABEL[to]}
                    </button>
                  </form>
                ))}
              </div>
            )}
            <form action={addNoteAction} className="adm-field">
              <input type="hidden" name="orderId" value={order.id} />
              <label htmlFor="note">Add an internal note (kept in the history below)</label>
              <textarea id="note" name="note" rows={3} maxLength={2000} placeholder="Rang the customer, no answer — trying again tomorrow." />
              <div>
                <button type="submit" className="adm-btn">
                  Save note
                </button>
              </div>
            </form>
          </section>

          <section className="adm-card">
            <h2>History</h2>
            {order.events.length === 0 ? (
              <p className="adm-pad adm-sub">Nothing recorded yet. The customer placed this order online.</p>
            ) : (
              <ol className="adm-timeline">
                {order.events.map((e) => (
                  <li key={e.id}>
                    <strong>
                      {e.fromStatus && e.fromStatus !== e.toStatus
                        ? `${STATUS_LABEL[e.fromStatus]} → ${STATUS_LABEL[e.toStatus]}`
                        : "Note"}
                    </strong>
                    <time>
                      {e.createdAt}
                      {e.by ? ` · ${e.by}` : ""}
                    </time>
                    {e.note && <p className="adm-note">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="adm-stack">
          <section className="adm-card">
            <h2>Customer</h2>
            <dl className="adm-dl">
              <div>
                <dt>Name</dt>
                <dd dir="auto">{order.name}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd className="adm-num">
                  <a href={`tel:${order.phone.replace(/\s/g, "")}`}>{order.phone}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—"}</dd>
              </div>
              <div>
                <dt>Deliver to</dt>
                <dd>
                  <OrderAddress order={order} />
                </dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
