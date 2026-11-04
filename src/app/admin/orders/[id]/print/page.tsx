import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, type OrderDetail } from "@/lib/admin/orders";
import { COMPANY } from "@/lib/company";
import { DELIVERY, formatPrice } from "@/lib/types";
import { OrderAddress } from "../../../_components/OrderAddress";
import { PrintButton } from "../../../_components/PrintButton";

export const metadata = { title: "Delivery note", robots: { index: false, follow: false } };

/**
 * Printable delivery note — no PDF dependency. Two copies on one A4 sheet: the customer
 * keeps one, the driver brings the other back signed. "Save as PDF" in the browser's print
 * dialog covers the rare case where someone wants a file.
 */
function Copy({ order, label }: { order: OrderDetail; label: string }) {
  const number = `#${String(order.number).padStart(5, "0")}`;
  return (
    <section className="adm-note-sheet">
      <div className="adm-note-head">
        <div>
          <strong style={{ fontSize: 17 }}>{COMPANY.tradingName}</strong>
          <div className="adm-sub">Delivery note · {label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong className="adm-num" style={{ fontSize: 17 }}>
            {number}
          </strong>
          <div className="adm-sub">{order.createdAt}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div className="adm-sub">Deliver to</div>
          <strong dir="auto">{order.name}</strong>
          <OrderAddress order={order} />
          <div className="adm-num" style={{ marginTop: 6 }}>
            {order.phone}
          </div>
        </div>
        <div>
          <div className="adm-sub">Items</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "2px 0" }}>{item.qty} ×</td>
                  <td dir="auto" style={{ padding: "2px 6px" }}>
                    {item.name}
                  </td>
                  <td style={{ padding: "2px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatPrice(item.price * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-note-collect">
        <span>
          Cash to collect on delivery
          {order.feeTbc && <strong> — plus the agreed delivery fee</strong>}
        </span>
        <strong>{formatPrice(order.totalCents)}</strong>
      </div>

      <div className="adm-sub" style={{ fontSize: 12 }}>
        Includes VAT at 5% ({formatPrice(order.vatCents)}). Returns within 15 days for unused,
        unassembled items in their original packaging. Questions: {COMPANY.phone}.
      </div>

      <div className="adm-note-sign">
        <div>Received by (signature)</div>
        <div>Cash received by (driver)</div>
      </div>
    </section>
  );
}

export default async function PrintNotePage({ params }: PageProps<"/admin/orders/[id]/print">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className="adm-note">
      <div className="adm-no-print" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Link className="adm-btn" href={`/admin/orders/${order.id}`}>
          ← Back to order
        </Link>
        <PrintButton />
        <span className="adm-sub" style={{ alignSelf: "center" }}>
          Two copies per sheet — customer and driver. Delivery in {DELIVERY.days}.
        </span>
      </div>

      <Copy order={order} label="Customer copy" />
      <hr className="adm-cut" />
      <Copy order={order} label="Driver copy — return signed" />
    </div>
  );
}
