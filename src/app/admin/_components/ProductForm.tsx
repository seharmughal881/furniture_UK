"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveProductAction, type ProductSaveState } from "../actions";
import { ImageManager } from "./ImageManager";
import { ModelManager } from "./ModelManager";
import { VideoManager } from "./VideoManager";
import { VariantEditor, type VariantDraft } from "./VariantEditor";
import type { ProductEdit } from "@/lib/admin/products";
import { CATEGORIES, ROOMS } from "@/lib/catalog-data";
import { KINDS } from "@/three/furniture";

/**
 * The add/edit product form, shared by /admin/products/new and /admin/products/[id].
 *
 * A client component for three reasons: the photo and option editors are interactive, the
 * web address auto-fills from the name while typing, and useActionState keeps everything
 * the owner typed when the server rejects a save -- re-typing forty fields because one
 * price was malformed is not acceptable.
 *
 * It holds no authority. `canEditPrices` only decides what is shown; updateProduct() in
 * src/lib/admin/products.ts re-checks the role against the session before writing, so a
 * tampered form cannot move a price.
 */

/** Baisa (integer minor units) to the rial string the owner reads and types. */
const toRials = (baisa: number | null) => (baisa === null ? "" : (baisa / 1000).toFixed(3));

/** Mirrors the slug rule in productSlugSchema, so the suggestion is always valid. */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

function SaveBar({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="adm-actions adm-save-bar">
      <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
        {pending ? "Saving…" : isNew ? "Add product" : "Save changes"}
      </button>
      <Link href="/admin/products" className="adm-btn adm-btn-quiet">
        Cancel
      </Link>
    </div>
  );
}

export function ProductForm({
  product,
  canEditPrices,
  uploadsEnabled,
}: {
  product: ProductEdit | null;
  canEditPrices: boolean;
  uploadsEnabled: boolean;
}) {
  const [state, formAction] = useActionState<ProductSaveState, FormData>(saveProductAction, {});
  const isNew = product === null;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  // Once the owner edits the address by hand, stop overwriting it from the name.
  const [slugLocked, setSlugLocked] = useState(!isNew);

  const err = (field: string) => {
    const messages = state.fieldErrors?.[field];
    return messages?.length ? <em className="adm-err">{messages[0]}</em> : null;
  };
  const invalid = (field: string) => (state.fieldErrors?.[field]?.length ? "invalid" : "");

  const variants: VariantDraft[] = (product?.variants ?? []).map((v) => ({
    title: v.title,
    price: toRials(v.price_cents),
    compareAt: toRials(v.compare_at_cents),
    available: v.available !== false,
  }));

  return (
    <form action={formAction} className="adm-form">
      {product && <input type="hidden" name="id" value={product.id} />}

      {state.error && (
        <p className="adm-notice" role="alert">
          {state.error}
        </p>
      )}

      <section className="adm-card adm-pad">
        <h2>Basics</h2>
        <div className="adm-field-grid">
          <label className={`adm-field ${invalid("name")}`}>
            <span>Product name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugLocked) setSlug(slugify(e.target.value));
              }}
              maxLength={200}
              required
            />
            {err("name")}
          </label>

          <label className={`adm-field ${invalid("nameAr")}`}>
            <span>Arabic name (optional)</span>
            <input name="nameAr" defaultValue={product?.nameAr ?? ""} maxLength={200} dir="rtl" lang="ar" />
            {err("nameAr")}
          </label>

          <label className={`adm-field ${invalid("slug")}`}>
            <span>Web address</span>
            <input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugLocked(true);
              }}
              maxLength={120}
              required
            />
            <small className="adm-stat-note">muscatfurniture.com/product/{slug || "…"}</small>
            {err("slug")}
          </label>

          <label className={`adm-field ${invalid("tagline")}`}>
            <span>Short tagline</span>
            <input name="tagline" defaultValue={product?.tagline ?? ""} maxLength={300} />
            {err("tagline")}
          </label>
        </div>
      </section>

      <section className="adm-card adm-pad">
        <h2>Price &amp; stock</h2>
        {!canEditPrices && (
          <p className="adm-stat-note">Prices are read-only for your account. Ask a manager to change them.</p>
        )}
        <div className="adm-field-grid">
          <label className={`adm-field ${invalid("priceCents")}`}>
            <span>Price (OMR)</span>
            <input
              name="price"
              defaultValue={toRials(product?.priceCents ?? null)}
              placeholder="475.000"
              inputMode="decimal"
              readOnly={!canEditPrices}
              required
            />
            {err("priceCents")}
          </label>

          <label className={`adm-field ${invalid("compareAtCents")}`}>
            <span>Was price (optional)</span>
            <input
              name="compareAt"
              defaultValue={toRials(product?.compareAtCents ?? null)}
              placeholder="—"
              inputMode="decimal"
              readOnly={!canEditPrices}
            />
            <small className="adm-stat-note">Shown struck through, to display a discount.</small>
            {err("compareAtCents")}
          </label>

          <label className={`adm-field ${invalid("stockQty")}`}>
            <span>Stock count (optional)</span>
            <input name="stockQty" defaultValue={product?.stockQty ?? ""} inputMode="numeric" placeholder="not counted" />
            <small className="adm-stat-note">
              Leave blank to use the switch below. If you enter a number, 0 marks it out of stock automatically.
            </small>
            {err("stockQty")}
          </label>

          <div className="adm-field">
            <span>Switches</span>
            <label className="adm-check">
              <input type="checkbox" name="inStock" defaultChecked={product?.inStock ?? true} />
              In stock
            </label>
            <label className="adm-check">
              <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} />
              Featured on the home page
            </label>
            <label className="adm-check">
              <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
              Visible on the website
            </label>
          </div>
        </div>
      </section>

      <section className="adm-card adm-pad">
        <h2>Where it appears</h2>
        <div className="adm-field-grid">
          <label className={`adm-field ${invalid("category")}`}>
            <span>Category</span>
            <select name="category" defaultValue={product?.category ?? CATEGORIES[0].slug}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {err("category")}
          </label>

          <label className={`adm-field ${invalid("subcategory")}`}>
            <span>Subcategory (optional)</span>
            <input name="subcategory" defaultValue={product?.subcategory ?? ""} maxLength={80} />
            <small className="adm-stat-note">For your own grouping; the shop does not filter by it yet.</small>
            {err("subcategory")}
          </label>

          <div className="adm-field">
            <span>Rooms</span>
            {ROOMS.map((r) => (
              <label key={r.slug} className="adm-check">
                <input
                  type="checkbox"
                  name="rooms"
                  value={r.slug}
                  defaultChecked={product?.rooms?.includes(r.slug) ?? false}
                />
                {r.name}
              </label>
            ))}
            {err("rooms")}
          </div>

          <label className={`adm-field ${invalid("kind")}`}>
            <span>3D model shape</span>
            <select name="kind" defaultValue={product?.kind ?? ""}>
              <option value="">No 3D model</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <small className="adm-stat-note">
              Lets the product be placed in the room planner.
              {product?.modelStatus ? ` AI model: ${product.modelStatus}.` : ""}
            </small>
            {err("kind")}
          </label>
        </div>
      </section>

      <section className="adm-card adm-pad">
        <h2>Photos</h2>
        <ImageManager name="images" initial={product?.images ?? []} uploadsEnabled={uploadsEnabled} />
        {err("images")}
      </section>

      <section className="adm-card adm-pad">
        <h2>Video</h2>
        <VideoManager name="videoUrl" initial={product?.videoUrl ?? ""} uploadsEnabled={uploadsEnabled} />

        <h2>3D model</h2>
        {/*
          Keyed on the stored value so the box is rebuilt whenever the server's value
          changes. useState only reads `initial` on mount, so after a save-and-redirect
          React reused the old instance and kept showing what had been typed -- the form
          claimed a model was set while the database still held the previous one. Keying
          it means the form can only ever show what was actually saved.
        */}
        <ModelManager
          key={product?.modelUrl ?? ""}
          name="modelUrl"
          initial={product?.modelUrl ?? ""}
          uploadsEnabled={uploadsEnabled}
        />
        {err("videoUrl")}
      </section>

      <section className="adm-card adm-pad">
        <h2>Options</h2>
        <VariantEditor name="variants" initial={variants} canEditPrices={canEditPrices} />
        {err("variants")}
      </section>

      <section className="adm-card adm-pad">
        <h2>Description</h2>
        <label className={`adm-field ${invalid("description")}`}>
          <span>Full description</span>
          <textarea name="description" defaultValue={product?.description ?? ""} rows={6} maxLength={8000} />
          {err("description")}
        </label>
        <label className={`adm-field ${invalid("details")}`}>
          <span>Bullet points</span>
          <textarea
            name="details"
            defaultValue={(product?.details ?? []).join("\n")}
            rows={5}
            placeholder={"One per line, e.g.\nSolid oak frame\nRemovable covers"}
          />
          {err("details")}
        </label>
        <label className={`adm-field ${invalid("care")}`}>
          <span>Care instructions</span>
          <textarea name="care" defaultValue={product?.care ?? ""} rows={3} maxLength={2000} />
          {err("care")}
        </label>
      </section>

      <section className="adm-card adm-pad">
        <h2>Details</h2>
        <div className="adm-field-grid">
          <label className={`adm-field ${invalid("widthCm")}`}>
            <span>Width (cm)</span>
            <input name="widthCm" defaultValue={product?.widthCm ?? ""} inputMode="numeric" />
            {err("widthCm")}
          </label>
          <label className={`adm-field ${invalid("depthCm")}`}>
            <span>Depth (cm)</span>
            <input name="depthCm" defaultValue={product?.depthCm ?? ""} inputMode="numeric" />
            {err("depthCm")}
          </label>
          <label className={`adm-field ${invalid("heightCm")}`}>
            <span>Height (cm)</span>
            <input name="heightCm" defaultValue={product?.heightCm ?? ""} inputMode="numeric" />
            {err("heightCm")}
          </label>
          <label className={`adm-field ${invalid("leadTimeWeeks")}`}>
            <span>Lead time (weeks)</span>
            <input name="leadTimeWeeks" defaultValue={product?.leadTimeWeeks ?? ""} inputMode="numeric" />
            {err("leadTimeWeeks")}
          </label>
          <label className={`adm-field ${invalid("sku")}`}>
            <span>SKU</span>
            <input name="sku" defaultValue={product?.sku ?? ""} maxLength={80} />
            {err("sku")}
          </label>
          <label className={`adm-field ${invalid("vendor")}`}>
            <span>Supplier</span>
            <input name="vendor" defaultValue={product?.vendor ?? ""} maxLength={120} />
            {err("vendor")}
          </label>
          <label className={`adm-field ${invalid("colour")}`}>
            <span>Main colour</span>
            <input name="colour" defaultValue={product?.colour ?? ""} maxLength={60} />
            <small className="adm-stat-note">Used to tint the 3D preview.</small>
            {err("colour")}
          </label>
        </div>
      </section>

      <SaveBar isNew={isNew} />
    </form>
  );
}
