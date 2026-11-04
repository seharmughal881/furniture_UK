import Link from "next/link";
import { listOrders, statusCounts } from "@/lib/admin/orders";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/admin/status";
import { GOVERNORATES } from "@/lib/catalog-data";
import { formatPrice } from "@/lib/types";
import { orderSearchSchema } from "@/lib/validation";
import { StatusBadge } from "../_components/StatusBadge";

export const metadata = { title: "Orders", robots: { index: false, follow: false } };

type Query = { status?: string; gov?: string; q?: string; page?: string };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters live in the URL, like the storefront's shop page, so a view can be shared. */
const linkTo = (current: Query, patch: Query) => {
  const next = { ...current, page: undefined, ...patch };
  const qs = new URLSearchParams(
    Object.entries(next).filter(([, v]) => v) as [string, string][],
  ).toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
};

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const query: Query = { status: one(sp.status), gov: one(sp.gov), q: one(sp.q), page: one(sp.page) };
  const error = one(sp.error);

  const parsed = orderSearchSchema.safeParse(query);
  const filters = parsed.success ? parsed.data : {};

  const [list, counts] = await Promise.all([
    listOrders({
      status: filters.status,
      governorate: filters.gov,
      search: filters.q,
      page: filters.page,
    }),
    statusCounts(),
  ]);

  const openCount = ORDER_STATUSES.filter((s) => s === "placed" || s === "confirmed" || s === "dispatched")
    .reduce((n, s) => n + (counts[s] ?? 0), 0);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Orders</h1>
          <p className="adm-sub">
            {list.total} {list.total === 1 ? "order" : "orders"} match
            {openCount > 0 && <> · {openCount} still to deliver</>}
          </p>
        </div>
      </div>

      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}

      <div className="adm-filters">
        <div className="adm-chips">
          <Link href={linkTo(query, { status: undefined })} className={`adm-chip ${!query.status ? "on" : ""}`}>
            All
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link
              key={s}
              href={linkTo(query, { status: s })}
              className={`adm-chip ${query.status === s ? "on" : ""}`}
            >
              {STATUS_LABEL[s]}
              <small>{counts[s] ?? 0}</small>
            </Link>
          ))}
        </div>

        {/* GET form: the search lands in the URL, so it survives a reload and can be shared */}
        <form className="adm-search" method="get" action="/admin/orders">
          {query.status && <input type="hidden" name="status" value={query.status} />}
          {query.gov && <input type="hidden" name="gov" value={query.gov} />}
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Name, phone or #order number"
            aria-label="Search orders"
          />
          <button className="adm-btn" type="submit">
            Search
          </button>
          {query.q && (
            <Link href={linkTo(query, { q: undefined })} className="adm-btn">
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="adm-filters">
        <div className="adm-chips">
          <Link href={linkTo(query, { gov: undefined })} className={`adm-chip ${!query.gov ? "on" : ""}`}>
            All Oman
          </Link>
          {GOVERNORATES.map((g) => (
            <Link key={g} href={linkTo(query, { gov: g })} className={`adm-chip ${query.gov === g ? "on" : ""}`}>
              {g}
            </Link>
          ))}
        </div>
      </div>

      <div className="adm-table-wrap">
        {list.rows.length === 0 ? (
          <p className="adm-empty">No orders match these filters.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Deliver to</th>
                <th>Items</th>
                <th className="adm-money">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((o) => (
                <tr key={o.id}>
                  <td className="adm-num">
                    <Link href={`/admin/orders/${o.id}`} className="adm-row-link">
                      #{String(o.number).padStart(5, "0")}
                    </Link>
                  </td>
                  <td>
                    {o.placedAt}
                    {o.overdue && <span className="adm-flag" title="Placed over a day ago and not confirmed yet">Call overdue</span>}
                  </td>
                  <td dir="auto">{o.name}</td>
                  <td className="adm-num">
                    <a href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a>
                  </td>
                  <td dir="auto">
                    {o.city}
                    {o.city && o.county ? ", " : ""}
                    {o.county}
                  </td>
                  <td>{o.itemCount}</td>
                  <td className="adm-money">
                    {formatPrice(o.totalCents)}
                    {o.feeTbc && <span className="adm-flag">fee TBC</span>}
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
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
            <Link className="adm-btn" href={linkTo(query, { page: String(list.page - 1) })}>
              ← Previous
            </Link>
          )}
          <span>
            Page {list.page} of {list.pages}
          </span>
          {list.page < list.pages && (
            <Link className="adm-btn" href={linkTo(query, { page: String(list.page + 1) })}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
