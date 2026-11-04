import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProductForEdit } from "@/lib/admin/products";
import { currentAdmin } from "@/lib/admin/session";
import { formatPrice } from "@/lib/types";
import { archiveProductAction, deleteProductAction } from "../../actions";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { ProductForm } from "../../_components/ProductForm";

export const metadata = { title: "Edit product", robots: { index: false, follow: false } };

/** Field names as the shop owner knows them, for the history list. */
const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  name_ar: "Arabic name",
  slug: "Web address",
  category: "Category",
  subcategory: "Subcategory",
  rooms: "Rooms",
  kind: "3D shape",
  tagline: "Tagline",
  description: "Description",
  details: "Bullet points",
  care: "Care",
  price_cents: "Price",
  compare_at_cents: "Was price",
  stock_qty: "Stock count",
  in_stock: "In stock",
  featured: "Featured",
  active: "Visible",
  sku: "SKU",
  vendor: "Supplier",
  colour: "Colour",
  width_cm: "Width",
  depth_cm: "Depth",
  height_cm: "Height",
  lead_time_weeks: "Lead time",
  images: "Photos",
  variants: "Options",
};

const MONEY_FIELDS = new Set(["price_cents", "compare_at_cents"]);

/** Render one audit value readably, without dumping JSON at a non-technical reader. */
function showValue(field: string, value: unknown): string {
  if (value === null || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatPrice(value);
  if (Array.isArray(value)) return value.length === 0 ? "empty" : `${value.length} item(s)`;
  if (typeof value === "object") return "updated";
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const admin = await currentAdmin();
  if (!admin) redirect(`/admin/login?next=/admin/products/${id}`);

  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const product = await getProductForEdit(numericId);
  if (!product) notFound();

  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const saved = sp.saved !== undefined;
  const isManager = admin.role === "manager";

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 dir="auto">{product.name}</h1>
          <p className="adm-sub">
            {product.active ? "Live on the website" : "Archived — hidden from the website"}
            {product.unitsSold > 0 && <> · {product.unitsSold} sold</>}
            {" · "}
            <Link href={`/product/${product.slug}`} className="adm-row-link">
              View on the website →
            </Link>
          </p>
        </div>
      </div>

      {saved && !error && <p className="adm-note" role="status">Saved. The website is already showing it.</p>}
      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}

      <ProductForm
        product={product}
        canEditPrices={isManager}
        uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
      />

      <section className="adm-card adm-pad">
        <h2>{product.active ? "Hide or remove" : "Bring back or remove"}</h2>
        <p className="adm-stat-note">
          Archiving hides a product from the website but keeps it, and keeps every order that contains it
          intact. {product.unitsSold > 0
            ? "This product appears on an order, so it can only be archived — deleting it would rewrite order history."
            : "This product has never been ordered, so it can also be deleted permanently."}
        </p>
        <div className="adm-actions">
          <form action={archiveProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="active" value={String(!product.active)} />
            <button type="submit" className="adm-btn">
              {product.active ? "Archive" : "Make live again"}
            </button>
          </form>

          {isManager && product.unitsSold === 0 && (
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmSubmit
                label="Delete permanently"
                confirmLabel="Yes, delete it"
                question="Delete this product for good?"
              />
            </form>
          )}
        </div>
      </section>

      <section className="adm-card">
        <h2>History</h2>
        {product.events.length === 0 ? (
          <p className="adm-empty">No changes recorded yet.</p>
        ) : (
          <ul className="adm-timeline">
            {product.events.map((e) => {
              const fields = Object.entries(e.changes ?? {});
              return (
                <li key={e.id}>
                  <strong>{e.action === "updated" ? "Edited" : e.action}</strong>{" "}
                  <span className="adm-stat-note">
                    {e.createdAt}
                    {e.by ? ` · ${e.by}` : ""}
                  </span>
                  {fields.length > 0 && (
                    <ul className="adm-changes">
                      {fields.map(([field, pair]) => (
                        <li key={field}>
                          {FIELD_LABEL[field] ?? field}: {showValue(field, pair?.[0])} →{" "}
                          <b>{showValue(field, pair?.[1])}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
