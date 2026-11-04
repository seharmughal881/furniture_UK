import Link from "next/link";
import { getBestSellers, getOutOfStock, getRecentOrders, getTotals } from "@/lib/admin/dashboard";
import { formatPrice } from "@/lib/types";
import { StatusBadge } from "./_components/StatusBadge";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

/**
 * The back-office home page. Every figure is read live from the database by
 * src/lib/admin/dashboard.ts, which guards each query with requireAdmin().
 *
 * The four reads run in parallel: they are independent, and awaiting them in sequence
 * would make the page as slow as the sum of the four.
 */
export default async function DashboardPage() {
  const [totals, recent, bestSellers, outOfStock] = await Promise.all([
    getTotals(),
    getRecentOrders(),
    getBestSellers(),
    getOutOfStock(),
  ]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Dashboard</h1>
          <p className="adm-sub">
            {totals.ordersToday === 0
              ? "No orders yet today"
              : `${totals.ordersToday} ${totals.ordersToday === 1 ? "order" : "orders"} today`}
            {totals.awaitingCall > 0 && <> · {totals.awaitingCall} waiting for a confirmation call</>}
          </p>
        </div>
      </div>

      <div className="adm-stats">
        <Link href="/admin/orders?status=placed" className="adm-stat" data-tone={totals.awaitingCall > 0 ? "urgent" : undefined}>
          <span className="adm-stat-label">To confirm</span>
          <strong className="adm-stat-value">{totals.awaitingCall}</strong>
          <span className="adm-stat-note">Placed, not yet called</span>
        </Link>

        <Link href="/admin/orders" className="adm-stat">
          <span className="adm-stat-label">Open orders</span>
          <strong className="adm-stat-value">{totals.openOrders}</strong>
          <span className="adm-stat-note">{formatPrice(totals.inProgressCents)} in progress</span>
        </Link>

        <div className="adm-stat">
          <span className="adm-stat-label">Cash collected</span>
          <strong className="adm-stat-value adm-stat-money">{formatPrice(totals.collectedCents)}</strong>
          <span className="adm-stat-note">Delivered orders only</span>
        </div>

        <Link href="/admin/orders" className="adm-stat">
          <span className="adm-stat-label">Total orders</span>
          <strong className="adm-stat-value">{totals.orders}</strong>
          <span className="adm-stat-note">All time</span>
        </Link>

        <div className="adm-stat">
          <span className="adm-stat-label">Customers</span>
          <strong className="adm-stat-value">{totals.customers}</strong>
          <span className="adm-stat-note">By phone number</span>
        </div>

        <Link href="/admin/products" className="adm-stat" data-tone={totals.outOfStock > 0 ? "warn" : undefined}>
          <span className="adm-stat-label">Products</span>
          <strong className="adm-stat-value">{totals.products}</strong>
          <span className="adm-stat-note">
            {totals.outOfStock > 0 ? `${totals.outOfStock} out of stock` : "All in stock"}
          </span>
        </Link>

        <Link
          href="/admin/reviews?status=pending"
          className="adm-stat"
          data-tone={totals.pendingReviews > 0 ? "urgent" : undefined}
        >
          <span className="adm-stat-label">Reviews to read</span>
          <strong className="adm-stat-value">{totals.pendingReviews}</strong>
          <span className="adm-stat-note">Hidden until approved</span>
        </Link>

        <Link
          href="/admin/inquiries?status=new"
          className="adm-stat"
          data-tone={totals.newInquiries > 0 ? "urgent" : undefined}
        >
          <span className="adm-stat-label">New enquiries</span>
          <strong className="adm-stat-value">{totals.newInquiries}</strong>
          <span className="adm-stat-note">Quote requests</span>
        </Link>
      </div>

      <div className="adm-grid-2">
        <section className="adm-card">
          <h2>Recent orders</h2>
          {recent.length === 0 ? (
            <p className="adm-empty">No orders yet.</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="adm-money">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-num">
                      <Link href={`/admin/orders/${o.id}`} className="adm-row-link">
                        #{String(o.number).padStart(5, "0")}
                      </Link>
                      <small className="adm-stat-note"> {o.placedAt}</small>
                    </td>
                    <td dir="auto">
                      {o.name}
                      {o.city && <small className="adm-stat-note"> {o.city}</small>}
                    </td>
                    <td className="adm-money">{formatPrice(o.totalCents)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="adm-card">
          <h2>Best sellers</h2>
          {bestSellers.length === 0 ? (
            <p className="adm-empty">Nothing has sold yet.</p>
          ) : (
            <ul className="adm-rank">
              {bestSellers.map((p, i) => (
                <li key={p.slug}>
                  <span className="adm-rank-no">{i + 1}</span>
                  <Link href={`/product/${p.slug}`} className="adm-rank-name" dir="auto">
                    {p.name}
                  </Link>
                  <span className="adm-rank-units">
                    {p.units} sold
                    <small className="adm-stat-note"> {formatPrice(p.revenueCents)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="adm-card">
        <h2>Out of stock{totals.outOfStock > 0 && <small className="adm-stat-note"> {totals.outOfStock} total</small>}</h2>
        {outOfStock.length === 0 ? (
          <p className="adm-empty">Every active product is in stock.</p>
        ) : (
          <ul className="adm-rank">
            {outOfStock.map((p) => (
              <li key={p.slug}>
                <Link href={`/product/${p.slug}`} className="adm-rank-name" dir="auto">
                  {p.name}
                </Link>
                <span className="adm-rank-units">
                  {p.category}
                  <small className="adm-stat-note"> {formatPrice(p.priceCents)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
