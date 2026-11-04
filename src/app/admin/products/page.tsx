import Link from "next/link";
import { listProducts, productFacets, type ProductSort } from "@/lib/admin/products";
import { CATEGORIES, ROOMS } from "@/lib/catalog-data";
import { formatPrice } from "@/lib/types";
import { productSearchSchema } from "@/lib/validation";
import { setProductFlagAction } from "../actions";

export const metadata = { title: "Products", robots: { index: false, follow: false } };

type Query = {
  q?: string;
  category?: string;
  room?: string;
  stock?: string;
  status?: string;
  sort?: string;
  page?: string;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters live in the URL, like the order list and the storefront's shop page. */
const linkTo = (current: Query, patch: Query) => {
  const next = { ...current, page: undefined, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
};

const SORT_LABEL: Record<ProductSort, string> = {
  recent: "Newest",
  name: "Name A–Z",
  "price-asc": "Cheapest",
  "price-desc": "Dearest",
  featured: "Featured first",
};

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const sp = await searchParams;
  const query: Query = {
    q: one(sp.q),
    category: one(sp.category),
    room: one(sp.room),
    stock: one(sp.stock),
    status: one(sp.status),
    sort: one(sp.sort),
    page: one(sp.page),
  };
  const error = one(sp.error);
  const notice = one(sp.notice);

  const parsed = productSearchSchema.safeParse(query);
  const filters = parsed.success ? parsed.data : {};

  const [list, facets] = await Promise.all([listProducts(filters), productFacets()]);
  const here = linkTo(query, {});

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Products</h1>
          <p className="adm-sub">
            {list.total} {list.total === 1 ? "product" : "products"} match · {facets.active} live,{" "}
            {facets.archived} archived
            {facets.outOfStock > 0 && <> · {facets.outOfStock} out of stock</>}
          </p>
        </div>
        <Link href="/admin/products/new" className="adm-btn adm-btn-primary">
          Add a product
        </Link>
      </div>

      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="adm-note" role="status">{notice}</p>}

      <div className="adm-filters">
        <form className="adm-search" method="get" action="/admin/products">
          {query.category && <input type="hidden" name="category" value={query.category} />}
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <input name="q" defaultValue={query.q ?? ""} placeholder="Name, SKU or web address" aria-label="Search products" />
          <button className="adm-btn" type="submit">
            Search
          </button>
          {query.q && (
            <Link href={linkTo(query, { q: undefined })} className="adm-btn">
              Clear
            </Link>
          )}
        </form>

        <div className="adm-chips">
          {(Object.keys(SORT_LABEL) as ProductSort[]).map((s) => (
            <Link
              key={s}
              href={linkTo(query, { sort: s })}
              className={`adm-chip ${(query.sort ?? "recent") === s ? "on" : ""}`}
            >
              {SORT_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="adm-filters">
        <div className="adm-chips">
          <Link href={linkTo(query, { category: undefined })} className={`adm-chip ${!query.category ? "on" : ""}`}>
            All categories
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={linkTo(query, { category: c.slug })}
              className={`adm-chip ${query.category === c.slug ? "on" : ""}`}
            >
              {c.name}
              <small>{facets.byCategory[c.slug] ?? 0}</small>
            </Link>
          ))}
        </div>
      </div>

      <div className="adm-filters">
        <div className="adm-chips">
          <Link href={linkTo(query, { status: undefined, stock: undefined })} className={`adm-chip ${!query.status && !query.stock ? "on" : ""}`}>
            Everything
          </Link>
          <Link href={linkTo(query, { status: "active", stock: undefined })} className={`adm-chip ${query.status === "active" ? "on" : ""}`}>
            Live
          </Link>
          <Link href={linkTo(query, { status: "archived", stock: undefined })} className={`adm-chip ${query.status === "archived" ? "on" : ""}`}>
            Archived
          </Link>
          <Link href={linkTo(query, { stock: "out", status: undefined })} className={`adm-chip ${query.stock === "out" ? "on" : ""}`}>
            Out of stock
          </Link>
          {ROOMS.map((r) => (
            <Link
              key={r.slug}
              href={linkTo(query, { room: r.slug })}
              className={`adm-chip ${query.room === r.slug ? "on" : ""}`}
            >
              {r.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="adm-table-wrap">
        {list.rows.length === 0 ? (
          <p className="adm-empty">No products match these filters.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Product</th>
                <th>Category</th>
                <th className="adm-money">Price</th>
                <th>Stock</th>
                <th>Sold</th>
                <th>Featured</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.image ? (
                      // A plain <img>, like the whole storefront: these are Shopify CDN
                      // and Blob URLs, which next/image would need allow-listed up front.
                      <img className="adm-row-thumb" src={p.image} alt="" loading="lazy" width={44} height={44} />
                    ) : (
                      <span className="adm-row-thumb adm-row-thumb-empty" aria-hidden />
                    )}
                  </td>
                  <td dir="auto">
                    <Link href={`/admin/products/${p.id}`} className="adm-row-link">
                      {p.name}
                    </Link>
                    {p.hasModel && <span className="adm-flag">3D</span>}
                    <small className="adm-stat-note"> /{p.slug}</small>
                  </td>
                  <td>
                    {CATEGORIES.find((c) => c.slug === p.category)?.name ?? p.category}
                    {p.subcategory && <small className="adm-stat-note"> · {p.subcategory}</small>}
                  </td>
                  <td className="adm-money">
                    {formatPrice(p.priceCents)}
                    {p.compareAtCents !== null && p.compareAtCents > p.priceCents && (
                      <small className="adm-stat-note"> was {formatPrice(p.compareAtCents)}</small>
                    )}
                  </td>
                  <td>
                    {/* A one-field form per row, so the switch works without JavaScript */}
                    <form action={setProductFlagAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="flag" value="in_stock" />
                      <input type="hidden" name="value" value={String(!p.inStock)} />
                      <input type="hidden" name="back" value={here} />
                      <button type="submit" className={`adm-toggle ${p.inStock ? "on" : ""}`}>
                        {p.inStock ? "In stock" : "Out of stock"}
                      </button>
                    </form>
                    {p.stockQty !== null && <small className="adm-stat-note">{p.stockQty} left</small>}
                  </td>
                  <td>{p.unitsSold > 0 ? p.unitsSold : "—"}</td>
                  <td>
                    <form action={setProductFlagAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="flag" value="featured" />
                      <input type="hidden" name="value" value={String(!p.featured)} />
                      <input type="hidden" name="back" value={here} />
                      <button type="submit" className={`adm-toggle ${p.featured ? "on" : ""}`}>
                        {p.featured ? "Featured" : "No"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <span className="adm-badge" data-status={p.active ? "delivered" : "cancelled"}>
                      {p.active ? "Live" : "Archived"}
                    </span>
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
