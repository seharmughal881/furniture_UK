import Link from "next/link";
import { notFound } from "next/navigation";
import { customerOrders, listCustomers } from "@/lib/admin/customers";
import { STATUS_LABEL, type OrderStatus } from "@/lib/admin/status";
import { formatPrice } from "@/lib/types";
import { StatusBadge } from "../../_components/StatusBadge";

export const metadata = { title: "Customer", robots: { index: false, follow: false } };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[phone]">) {
  const { phone } = await params;
  const orders = await customerOrders(phone);
  if (orders.length === 0) notFound();

  // The summary row for this one customer, reusing the same aggregation as the list so
  // the figures cannot disagree between the two pages.
  const found = await listCustomers(phone, 1);
  const customer = found.rows.find((c) => c.phoneKey === phone) ?? found.rows[0];
  if (!customer) notFound();

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 dir="auto">{customer.name}</h1>
          <p className="adm-sub">
            <a href={`tel:${customer.phone.replace(/\s/g, "")}`}>{customer.phone}</a>
            {customer.email && <> · <a href={`mailto:${customer.email}`}>{customer.email}</a></>}
            {" · "}
            <Link href="/admin/customers" className="adm-row-link">All customers →</Link>
          </p>
        </div>
      </div>

      <div className="adm-stats">
        <div className="adm-stat">
          <span className="adm-stat-label">Orders</span>
          <strong className="adm-stat-value">{customer.orders}</strong>
          <span className="adm-stat-note">since {customer.firstOrder}</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Cash collected</span>
          <strong className="adm-stat-value adm-stat-money">{formatPrice(customer.spentCents)}</strong>
          <span className="adm-stat-note">delivered orders</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-label">Open</span>
          <strong className="adm-stat-value adm-stat-money">{formatPrice(customer.openCents)}</strong>
          <span className="adm-stat-note">not yet delivered</span>
        </div>
        <div className="adm-stat" data-tone={customer.cancelled > 0 ? "warn" : undefined}>
          <span className="adm-stat-label">Cancelled</span>
          <strong className="adm-stat-value">{customer.cancelled}</strong>
          <span className="adm-stat-note">or returned</span>
        </div>
      </div>

      <section className="adm-card">
        <h2>Order history</h2>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Placed</th>
              <th className="adm-money">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="adm-num">
                  <Link href={`/admin/orders/${o.id}`} className="adm-row-link">
                    #{String(o.number).padStart(5, "0")}
                  </Link>
                </td>
                <td>{o.placedAt}</td>
                <td className="adm-money">{formatPrice(o.totalCents)}</td>
                <td>
                  {/* The status is constrained by orders_status_check, so it is always
                      one of the workflow states the badge knows. */}
                  <StatusBadge status={o.status as OrderStatus} />
                  <span className="adm-stat-note"> {STATUS_LABEL[o.status as OrderStatus] ? "" : o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
