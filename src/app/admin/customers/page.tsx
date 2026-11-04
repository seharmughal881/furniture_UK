import Link from "next/link";
import { listCustomers } from "@/lib/admin/customers";
import { formatPrice } from "@/lib/types";

export const metadata = { title: "Customers", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const page = Number(one(sp.page) ?? 1) || 1;
  const list = await listCustomers(q || null, page);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Customers</h1>
          <p className="adm-sub">
            {list.total} {list.total === 1 ? "customer" : "customers"} who have ordered. Grouped by phone number, so the
            same person placing three orders counts once.
          </p>
        </div>
      </div>

      <div className="adm-filters">
        <form className="adm-search" method="get" action="/admin/customers">
          <input name="q" defaultValue={q} placeholder="Name or phone number" aria-label="Search customers" />
          <button className="adm-btn" type="submit">Search</button>
          {q && <Link href="/admin/customers" className="adm-btn">Clear</Link>}
        </form>
      </div>

      <div className="adm-table-wrap">
        {list.rows.length === 0 ? (
          <p className="adm-empty">No customers match.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Area</th>
                <th>Orders</th>
                <th className="adm-money">Collected</th>
                <th className="adm-money">Open</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.phoneKey}>
                  <td dir="auto">
                    <Link href={`/admin/customers/${c.phoneKey}`} className="adm-row-link">
                      {c.name}
                    </Link>
                    {c.orders > 1 && <span className="adm-flag">repeat</span>}
                  </td>
                  <td className="adm-num">
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>
                  </td>
                  <td dir="auto">
                    {c.city}
                    {c.city && c.county ? ", " : ""}
                    {c.county}
                  </td>
                  <td>
                    {c.orders}
                    {c.cancelled > 0 && <small className="adm-stat-note"> {c.cancelled} cancelled</small>}
                  </td>
                  <td className="adm-money">{formatPrice(c.spentCents)}</td>
                  <td className="adm-money">{c.openCents > 0 ? formatPrice(c.openCents) : "—"}</td>
                  <td>
                    {c.lastOrder}
                    <small className="adm-stat-note"> first {c.firstOrder}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {list.pages > 1 && (
        <nav className="adm-pager" aria-label="Pages">
          {list.page > 1 && (
            <Link className="adm-btn" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${list.page - 1}`}>← Previous</Link>
          )}
          <span>Page {list.page} of {list.pages}</span>
          {list.page < list.pages && (
            <Link className="adm-btn" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${list.page + 1}`}>Next →</Link>
          )}
        </nav>
      )}
    </>
  );
}
