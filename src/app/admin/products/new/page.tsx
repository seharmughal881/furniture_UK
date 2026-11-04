import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/session";
import { ProductForm } from "../../_components/ProductForm";

export const metadata = { title: "Add a product", robots: { index: false, follow: false } };

/**
 * Adding a product sets its price, so only a manager may do it. The check is repeated in
 * createProduct() -- this one only avoids showing a form that cannot be submitted.
 */
export default async function NewProductPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login?next=/admin/products/new");
  if (admin.role !== "manager") {
    redirect("/admin/products?error=" + encodeURIComponent("Only a manager can add a product."));
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Add a product</h1>
          <p className="adm-sub">It stays hidden from the website until you tick “Visible”.</p>
        </div>
      </div>
      <ProductForm product={null} canEditPrices uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN} />
    </>
  );
}
