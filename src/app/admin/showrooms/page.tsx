import { listStores } from "@/lib/admin/stores";
import { currentAdmin } from "@/lib/admin/session";
import { deleteStoreAction, saveStoreAction } from "../actions";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

export const metadata = { title: "Showrooms", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Row = {
  id: number | null;
  slug: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  kind: string;
  sortOrder: number;
};

/**
 * Each showroom is its own small form rather than one giant form for the lot: there are
 * only a handful, the owner edits one at a time, and a per-row form means a mistake in
 * one cannot block saving another.
 */
function StoreForm({ row, canDelete }: { row: Row; canDelete: boolean }) {
  const isNew = row.id === null;
  return (
    <section className="adm-card adm-pad">
      <h2>{isNew ? "Add a showroom" : row.name || "Untitled"}</h2>
      <form action={saveStoreAction} className="adm-form">
        {!isNew && <input type="hidden" name="id" value={row.id ?? ""} />}
        <div className="adm-field-grid">
          <label className="adm-field">
            <span>Name</span>
            <input name="name" defaultValue={row.name} maxLength={200} required />
          </label>
          <label className="adm-field">
            <span>Short name</span>
            <input name="slug" defaultValue={row.slug} maxLength={120} placeholder="al-hail-north" required />
            <small className="adm-stat-note">Lowercase letters, numbers and hyphens.</small>
          </label>
          <label className="adm-field">
            <span>City</span>
            <input name="city" defaultValue={row.city} maxLength={120} />
          </label>
          <label className="adm-field">
            <span>Type</span>
            <select name="kind" defaultValue={row.kind || "showroom"}>
              <option value="showroom">Showroom</option>
              <option value="office">Office</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Address</span>
            <textarea name="address" defaultValue={row.address} rows={2} maxLength={600} />
          </label>
          <label className="adm-field">
            <span>Opening hours</span>
            <input name="hours" defaultValue={row.hours} maxLength={200} placeholder="Sat–Thu 9am–9pm" />
          </label>
          <label className="adm-field">
            <span>Phone</span>
            <input name="phone" defaultValue={row.phone} maxLength={60} />
          </label>
          <label className="adm-field">
            <span>WhatsApp</span>
            <input name="whatsapp" defaultValue={row.whatsapp} maxLength={30} />
            <small className="adm-stat-note">Digits with country code, e.g. 96893993950</small>
          </label>
          <label className="adm-field">
            <span>Email</span>
            <input name="email" defaultValue={row.email} maxLength={200} />
          </label>
          <label className="adm-field">
            <span>Order on the page</span>
            <input name="sortOrder" defaultValue={String(row.sortOrder)} inputMode="numeric" />
            <small className="adm-stat-note">Smaller numbers appear first.</small>
          </label>
        </div>
        <div className="adm-actions">
          <button type="submit" className="adm-btn adm-btn-primary">
            {isNew ? "Add showroom" : "Save changes"}
          </button>
        </div>
      </form>
      {!isNew && canDelete && (
        <form action={deleteStoreAction} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={row.id ?? ""} />
          <ConfirmSubmit label="Remove" confirmLabel="Yes, remove it" question="Remove this showroom?" />
        </form>
      )}
    </section>
  );
}

export default async function ShowroomsPage({ searchParams }: PageProps<"/admin/showrooms">) {
  const sp = await searchParams;
  const [stores, admin] = await Promise.all([listStores(), currentAdmin()]);
  const error = one(sp.error);

  const blank: Row = {
    id: null, slug: "", name: "", city: "", address: "", phone: "",
    whatsapp: "", email: "", hours: "", kind: "showroom",
    sortOrder: (stores.at(-1)?.sortOrder ?? 0) + 1,
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Showrooms</h1>
          <p className="adm-sub">
            {stores.length} {stores.length === 1 ? "location" : "locations"} · shown on the Showrooms page and in the
            footer.
          </p>
        </div>
      </div>

      {sp.saved !== undefined && !error && <p className="adm-note" role="status">Saved.</p>}
      {error && <p className="adm-notice" role="alert">{error}</p>}

      <div className="adm-stack">
        {stores.map((s) => (
          <StoreForm key={s.id} row={s} canDelete={admin?.role === "manager"} />
        ))}
        <StoreForm row={blank} canDelete={false} />
      </div>
    </>
  );
}
