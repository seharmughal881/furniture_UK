import "server-only";
import { pool } from "../db";
import type { ProductFormInput } from "../validation";
import { requireAdmin, type AdminUser } from "./session";

/**
 * Every admin read and write of the catalogue, and — as in orders.ts — **every exported
 * function calls requireAdmin() before it touches the pool**. See the note at the top of
 * orders.ts for why the guard lives with the data instead of on the route.
 *
 * Two rules this module enforces that the UI must not be trusted to:
 *
 *   1. Only a manager may change a price or delete a product. Hiding a field in the form
 *      is not enforcement, so the check happens here, against the role on the session.
 *   2. A product that has ever been ordered is never hard-deleted. order_items.product_id
 *      references products(id) with no ON DELETE clause, so the delete would fail anyway —
 *      but worse, succeeding would rewrite order history. Those are archived instead.
 */

const PAGE_SIZE = 24;

/** Whitelisted sort orders. The key arrives from the URL; the SQL never does. */
const SORTS = {
  recent: "p.created_at DESC, p.id DESC",
  name: "lower(p.name) ASC",
  "price-asc": "p.price_cents ASC, p.id",
  "price-desc": "p.price_cents DESC, p.id",
  featured: "p.featured DESC, p.sort_order, p.id",
} as const;

export type ProductSort = keyof typeof SORTS;

export type ProductListItem = {
  id: number;
  slug: string;
  name: string;
  category: string;
  subcategory: string;
  image: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number | null;
  inStock: boolean;
  featured: boolean;
  active: boolean;
  hasModel: boolean;
  unitsSold: number;
};

export type ProductList = { rows: ProductListItem[]; total: number; page: number; pages: number };

export type ProductFilters = {
  q?: string;
  category?: string;
  room?: string;
  stock?: "in" | "out";
  status?: "active" | "archived";
  sort?: ProductSort;
  page?: number;
};

export async function listProducts(filters: ProductFilters): Promise<ProductList> {
  await requireAdmin();

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const order = SORTS[filters.sort ?? "recent"] ?? SORTS.recent;

  // Substring search rather than prefix, because staff search by any word in a product
  // name. That cannot use products_name_lower_idx, but this table holds a few hundred
  // rows, so the scan is immaterial — revisit if the catalogue grows by an order of
  // magnitude.
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.category, p.subcategory,
            p.images[1] AS image,
            p.price_cents AS "priceCents", p.compare_at_cents AS "compareAtCents",
            p.stock_qty AS "stockQty", p.in_stock AS "inStock",
            p.featured, p.active,
            EXISTS (SELECT 1 FROM product_models m
                     WHERE m.product_id = p.id AND m.status = 'ready') AS "hasModel",
            COALESCE((SELECT sum(i.quantity)::int FROM order_items i
                       JOIN orders o ON o.id = i.order_id
                      WHERE i.product_id = p.id
                        AND o.status NOT IN ('cancelled', 'returned')), 0) AS "unitsSold",
            count(*) OVER ()::int AS "totalRows"
     FROM products p
     WHERE ($1::text IS NULL OR lower(p.name) LIKE '%' || lower($1) || '%'
                              OR lower(p.sku)  = lower($1)
                              OR p.slug        = lower($1))
       AND ($2::text IS NULL OR p.category = $2)
       AND ($3::text IS NULL OR $3 = ANY (p.rooms))
       AND ($4::bool IS NULL OR p.in_stock = $4)
       AND ($5::bool IS NULL OR p.active   = $5)
     ORDER BY ${order}
     LIMIT $6 OFFSET $7`,
    [
      filters.q?.trim() || null,
      filters.category?.trim() || null,
      filters.room?.trim() || null,
      filters.stock === undefined ? null : filters.stock === "in",
      filters.status === undefined ? null : filters.status === "active",
      PAGE_SIZE,
      (page - 1) * PAGE_SIZE,
    ],
  );

  const total = rows[0]?.totalRows ?? 0;
  return {
    // Mapped explicitly so the window count never leaks into the returned rows.
    rows: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory,
      image: r.image,
      priceCents: r.priceCents,
      compareAtCents: r.compareAtCents,
      stockQty: r.stockQty,
      inStock: r.inStock,
      featured: r.featured,
      active: r.active,
      hasModel: r.hasModel,
      unitsSold: r.unitsSold,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Counts for the filter chips above the list. */
export async function productFacets(): Promise<{
  byCategory: Record<string, number>;
  active: number;
  archived: number;
  outOfStock: number;
  total: number;
}> {
  await requireAdmin();
  const [cats, totals] = await Promise.all([
    pool.query(`SELECT category, count(*)::int AS n FROM products GROUP BY category`),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE active)::int AS active,
              count(*) FILTER (WHERE NOT active)::int AS archived,
              count(*) FILTER (WHERE active AND NOT in_stock)::int AS "outOfStock"
       FROM products`,
    ),
  ]);
  const t = totals.rows[0];
  return {
    byCategory: Object.fromEntries(cats.rows.map((r) => [r.category as string, r.n as number])),
    active: t.active,
    archived: t.archived,
    outOfStock: t.outOfStock,
    total: t.total,
  };
}

export type ProductVariant = {
  title: string;
  price_cents: number;
  compare_at_cents: number | null;
  available: boolean;
};

export type ProductEvent = {
  id: number;
  action: string;
  changes: Record<string, [unknown, unknown]>;
  by: string | null;
  createdAt: string;
};

/** Everything the edit form needs, plus this product's history. */
export type ProductEdit = {
  id: number;
  slug: string;
  name: string;
  nameAr: string;
  category: string;
  subcategory: string;
  rooms: string[];
  kind: string;
  tagline: string;
  description: string;
  details: string[];
  care: string;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number | null;
  inStock: boolean;
  featured: boolean;
  active: boolean;
  sku: string;
  vendor: string;
  colour: string;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  leadTimeWeeks: number | null;
  images: string[];
  variants: ProductVariant[];
  unitsSold: number;
  modelStatus: string | null;
  events: ProductEvent[];
};

export async function getProductForEdit(id: number): Promise<ProductEdit | null> {
  await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return null;

  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.name_ar AS "nameAr", p.category, p.subcategory,
            p.rooms, COALESCE(p.kind, '') AS kind, p.tagline, p.description, p.details, p.care,
            p.price_cents AS "priceCents", p.compare_at_cents AS "compareAtCents",
            p.stock_qty AS "stockQty", p.in_stock AS "inStock", p.featured, p.active,
            p.sku, p.vendor, p.colour,
            p.width_cm AS "widthCm", p.depth_cm AS "depthCm", p.height_cm AS "heightCm",
            p.lead_time_weeks AS "leadTimeWeeks", p.images, p.variants,
            COALESCE((SELECT sum(i.quantity)::int FROM order_items i
                       JOIN orders o ON o.id = i.order_id
                      WHERE i.product_id = p.id
                        AND o.status NOT IN ('cancelled', 'returned')), 0) AS "unitsSold",
            (SELECT m.status FROM product_models m WHERE m.product_id = p.id) AS "modelStatus",
            COALESCE((SELECT json_agg(json_build_object(
                        'id', e.id, 'action', e.action, 'changes', e.changes,
                        'by', COALESCE(NULLIF(e.actor_name, ''), u.name),
                        'createdAt', to_char(e.created_at AT TIME ZONE 'Asia/Muscat',
                                             'DD Mon YYYY, HH24:MI'))
                        ORDER BY e.created_at DESC, e.id DESC)
                      FROM product_events e
                      LEFT JOIN admin_users u ON u.id = e.admin_user_id
                      WHERE e.product_id = p.id), '[]'::json) AS events
     FROM products p WHERE p.id = $1`,
    [id],
  );
  return (rows[0] as ProductEdit | undefined) ?? null;
}

export type SaveResult = { ok: true; id: number; slug: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The columns an edit may touch, paired with how to read the value out of the form input.
 * Used both to build the UPDATE and to work out what actually changed for the audit row,
 * so the two can never drift apart.
 */
const FIELDS = [
  ["name", (i: ProductFormInput) => i.name],
  ["name_ar", (i: ProductFormInput) => i.nameAr],
  ["slug", (i: ProductFormInput) => i.slug],
  ["category", (i: ProductFormInput) => i.category],
  ["subcategory", (i: ProductFormInput) => i.subcategory],
  ["rooms", (i: ProductFormInput) => i.rooms],
  ["kind", (i: ProductFormInput) => (i.kind === "" ? null : i.kind)],
  ["tagline", (i: ProductFormInput) => i.tagline],
  ["description", (i: ProductFormInput) => i.description],
  ["details", (i: ProductFormInput) => i.details],
  ["care", (i: ProductFormInput) => i.care],
  ["price_cents", (i: ProductFormInput) => i.priceCents],
  ["compare_at_cents", (i: ProductFormInput) => i.compareAtCents],
  ["stock_qty", (i: ProductFormInput) => i.stockQty],
  // Derived, never taken straight from the form: when a count is kept, the switch must
  // agree with it, or the storefront would offer something that is not there.
  ["in_stock", (i: ProductFormInput) => (i.stockQty === null ? i.inStock : i.stockQty > 0)],
  ["featured", (i: ProductFormInput) => i.featured],
  ["active", (i: ProductFormInput) => i.active],
  ["sku", (i: ProductFormInput) => i.sku],
  ["vendor", (i: ProductFormInput) => i.vendor],
  ["colour", (i: ProductFormInput) => i.colour],
  ["width_cm", (i: ProductFormInput) => i.widthCm],
  ["depth_cm", (i: ProductFormInput) => i.depthCm],
  ["height_cm", (i: ProductFormInput) => i.heightCm],
  ["lead_time_weeks", (i: ProductFormInput) => i.leadTimeWeeks ?? 6],
  ["images", (i: ProductFormInput) => i.images],
  ["variants", (i: ProductFormInput) => JSON.stringify(i.variants)],
] as const;

/** Columns only a manager may move. */
const PRICE_FIELDS = new Set(["price_cents", "compare_at_cents", "variants"]);

const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) || Array.isArray(b) || typeof a === "object" || typeof b === "object"
    ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    : a === b;

/**
 * Variants compared positionally rather than as objects.
 *
 * Postgres does not preserve key order in jsonb -- it returns
 * {"title":…,"available":…,"price_cents":…} where the form sent
 * {title,price_cents,compare_at_cents,available}. Comparing the two as stringified
 * objects therefore reports a difference on *every* save, which would both fill the
 * history with phantom edits and, because `variants` counts as a price field, stop any
 * member of staff from saving a product at all.
 */
const canonicalVariants = (value: unknown) =>
  JSON.stringify(
    (Array.isArray(value) ? value : []).map((row) => {
      const v = row as Record<string, unknown>;
      return [v.title ?? "", v.price_cents ?? 0, v.compare_at_cents ?? null, v.available !== false];
    }),
  );

/** Postgres unique-violation, raised when a slug is already taken. */
const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

export async function createProduct(input: ProductFormInput): Promise<SaveResult> {
  const admin = await requireAdmin();
  if (admin.role !== "manager") {
    return { ok: false, error: "Only a manager can add a product, because it sets the price." };
  }

  const columns = FIELDS.map(([c]) => c);
  const values = FIELDS.map(([, read]) => read(input));
  const placeholders = columns.map((c, i) => (c === "variants" ? `$${i + 1}::jsonb` : `$${i + 1}`));

  try {
    const { rows } = await pool.query(
      `INSERT INTO products (${columns.join(", ")}, source)
       VALUES (${placeholders.join(", ")}, 'admin')
       RETURNING id, slug`,
      values,
    );
    const created = rows[0] as { id: number; slug: string };
    await recordEvent(admin, created.id, created.slug, "created", {});
    return { ok: true, id: created.id, slug: created.slug };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That web address is already used by another product." };
    throw err;
  }
}

export async function updateProduct(id: number, input: ProductFormInput): Promise<SaveResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown product." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Locked so two people saving the same product cannot interleave, and so the audit
    // row records the change against the state it was actually computed from.
    const { rows: before } = await client.query(
      `SELECT ${FIELDS.map(([c]) => c).join(", ")} FROM products WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = before[0] as Record<string, unknown> | undefined;
    if (!current) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Unknown product." };
    }

    const changes: Record<string, [unknown, unknown]> = {};
    for (const [column, read] of FIELDS) {
      if (column === "variants") {
        // Compared canonically, but recorded as the arrays themselves so the history
        // reads "Options: 2 item(s) → 3 item(s)" rather than a wall of JSON.
        if (canonicalVariants(current[column]) !== canonicalVariants(input.variants)) {
          changes[column] = [current[column] ?? [], input.variants];
        }
        continue;
      }
      const next = read(input);
      const now = current[column];
      if (!sameValue(now, next)) changes[column] = [now ?? null, next ?? null];
    }

    if (Object.keys(changes).length === 0) {
      await client.query("ROLLBACK");
      return { ok: true, id, slug: String(current.slug) };
    }

    const movedPrice = Object.keys(changes).some((c) => PRICE_FIELDS.has(c));
    if (movedPrice && admin.role !== "manager") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Only a manager can change prices. Your other edits were not saved." };
    }

    const columns = FIELDS.map(([c]) => c);
    const sets = columns.map((c, i) => `${c} = $${i + 2}${c === "variants" ? "::jsonb" : ""}`);
    await client.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $1`, [
      id,
      ...FIELDS.map(([, read]) => read(input)),
    ]);

    await recordEvent(admin, id, input.slug, "updated", changes, client);
    await client.query("COMMIT");
    return { ok: true, id, slug: input.slug };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (isUniqueViolation(err)) return { ok: false, error: "That web address is already used by another product." };
    throw err;
  } finally {
    client.release();
  }
}

/** Archive (active = false) or restore. Archived products vanish from the storefront. */
export async function setProductActive(id: number, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown product." };

  const { rows } = await pool.query(
    `UPDATE products SET active = $2 WHERE id = $1 AND active <> $2 RETURNING slug`,
    [id, active],
  );
  if (!rows[0]) return { ok: false, error: `That product is already ${active ? "live" : "archived"}.` };

  await recordEvent(admin, id, rows[0].slug, active ? "restored" : "archived", { active: [!active, active] });
  return { ok: true };
}

/**
 * Permanently remove a product — only when it has never been ordered.
 *
 * A product that appears on an order is archived instead and the caller is told so.
 * cart_items, reviews, inquiries and product_models all cascade, so they go with it;
 * order_items deliberately does not, which is what makes this check necessary.
 */
export async function deleteProduct(id: number): Promise<ActionResult & { archived?: boolean }> {
  const admin = await requireAdmin();
  if (admin.role !== "manager") return { ok: false, error: "Only a manager can delete a product." };
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown product." };

  const { rows: found } = await pool.query(
    `SELECT p.slug,
            EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = p.id) AS ordered
     FROM products p WHERE p.id = $1`,
    [id],
  );
  const row = found[0] as { slug: string; ordered: boolean } | undefined;
  if (!row) return { ok: false, error: "Unknown product." };

  if (row.ordered) {
    const archived = await setProductActive(id, false);
    return archived.ok
      ? { ok: true, archived: true }
      : { ok: false, error: "This product appears on an order, so it cannot be deleted. It is already archived." };
  }

  // The event row outlives the product: product_id is ON DELETE SET NULL and the slug is
  // copied in, so the history still says what was removed.
  await recordEvent(admin, id, row.slug, "deleted", {});
  await pool.query(`DELETE FROM products WHERE id = $1`, [id]);
  return { ok: true, archived: false };
}

/** Bulk switches from the list view, for the two things staff change most often. */
export async function setProductFlag(
  id: number,
  flag: "featured" | "in_stock",
  value: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown product." };

  // `flag` is narrowed to a union by the signature, so neither branch interpolates input.
  const column = flag === "featured" ? "featured" : "in_stock";
  const { rows } = await pool.query(
    `UPDATE products SET ${column} = $2 WHERE id = $1 AND ${column} <> $2 RETURNING slug`,
    [id, value],
  );
  if (!rows[0]) return { ok: false, error: "Nothing to change." };

  await recordEvent(admin, id, rows[0].slug, "updated", { [column]: [!value, value] });
  return { ok: true };
}

async function recordEvent(
  admin: AdminUser,
  productId: number,
  slug: string,
  action: "created" | "updated" | "archived" | "restored" | "deleted",
  changes: Record<string, [unknown, unknown]>,
  client: { query: typeof pool.query } = pool,
): Promise<void> {
  await client.query(
    `INSERT INTO product_events (product_id, product_slug, admin_user_id, actor_name, action, changes)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [productId, slug, admin.id, admin.name, action, JSON.stringify(changes)],
  );
}
