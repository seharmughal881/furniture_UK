-- Muscat Furniture: full database setup for a new, empty PostgreSQL database (e.g. Neon).
-- Paste into Neon -> SQL Editor -> Run. Safe to run more than once.
--
-- GENERATED FILE -- do not hand-edit. Regenerate with:  npm run db:neon-sql
--
-- Sources, concatenated in order:
--   db/schema.sql          the authoritative schema (what `npm run db:setup` applies)
--   db/seed-catalogue.sql  the seed materials, products and sample reviews
--
-- This file used to be hand-maintained and drifted badly: it had stopped at v7, so a
-- database created from it was missing the v8 product columns (stock_qty, subcategory,
-- vendor) and product_events, the whole v9 moderation inbox (reviews.status,
-- inquiries.status and their companions) and the v10 site_content table -- which
-- getContent() reads on every storefront page, so the whole site returned 500.

-- Atelier schema. Safe to run repeatedly.
--
-- pgcrypto is wanted for exactly one thing: gen_random_uuid(), used by the rooms, carts
-- and orders primary keys. That function moved into core in PostgreSQL 13, and nothing
-- here uses any other pgcrypto function -- every hash in this project is computed in Node
-- with node:crypto, never in SQL.
--
-- So the extension is requested but not required. A plain CREATE EXTENSION aborted the
-- whole setup on any server built without the contrib modules installed (a source build,
-- a slim container), even though PostgreSQL 13+ needs nothing at all. Requires PG 13 or
-- newer, which Neon and every supported release already are.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgcrypto unavailable (%); using the built-in gen_random_uuid() from PostgreSQL 13+.', SQLERRM;
END
$$;

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,           -- matches a procedural model in src/three/furniture.ts
  tagline         TEXT NOT NULL,
  description     TEXT NOT NULL,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  lead_time_weeks INTEGER NOT NULL DEFAULT 6,
  width_cm        INTEGER NOT NULL,
  depth_cm        INTEGER NOT NULL,
  height_cm       INTEGER NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('fabric', 'wood', 'metal')),
  hex        TEXT NOT NULL CHECK (hex ~ '^#[0-9a-fA-F]{6}$'),
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Saved layouts from the 3D room planner. layout = [{ id, kind, x, z, rot }]
CREATE TABLE IF NOT EXISTS rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL DEFAULT 'My room',
  layout     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote requests from the product configurator.
CREATE TABLE IF NOT EXISTS inquiries (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- chosen materials
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_product_idx ON inquiries(product_id);

-- ---------------------------------------------------------------- v2: commerce
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'seating';
ALTER TABLE products ADD COLUMN IF NOT EXISTS details TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS care TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_demo    BOOLEAN NOT NULL DEFAULT false,   -- seeded sample content; delete before launch
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id);

-- Anonymous carts keyed by an httpOnly cookie.
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One line per product + material configuration.
CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fabric     TEXT NOT NULL DEFAULT '',
  wood       TEXT NOT NULL DEFAULT '',
  metal      TEXT NOT NULL DEFAULT '',
  quantity   INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  UNIQUE (cart_id, product_id, fabric, wood, metal)
);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          SERIAL UNIQUE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  postcode        TEXT NOT NULL,
  country         TEXT NOT NULL,
  shipping_method TEXT NOT NULL,
  subtotal_cents  INTEGER NOT NULL,
  shipping_cents  INTEGER NOT NULL,
  total_cents     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'awaiting_payment',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prices are copied at purchase time so later catalogue changes don't rewrite history.
CREATE TABLE IF NOT EXISTS order_items (
  id               SERIAL PRIMARY KEY,
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  product_name     TEXT NOT NULL,
  config           JSONB NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rooms TEXT[] NOT NULL DEFAULT '{}';
-- v3: UK addresses
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address2 TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS county TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_cents INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------- v4: Muscat Furniture (Oman)
-- Money columns ending in _cents hold integer MINOR units of the shop currency
-- (baisa for OMR: 1 OMR = 1000 baisa).
ALTER TABLE products ALTER COLUMN kind DROP NOT NULL;              -- not every product has a 3D model
ALTER TABLE products ALTER COLUMN width_cm DROP NOT NULL;
ALTER TABLE products ALTER COLUMN depth_cm DROP NOT NULL;
ALTER TABLE products ALTER COLUMN height_cm DROP NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id BIGINT UNIQUE;    -- Shopify product id
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_cents INTEGER;     -- "was" price
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';   -- main fabric colour (3D preview)
-- [{ "title": "Grey", "price_cents": 475000, "compare_at_cents": 950000, "available": true }]
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS products_active_category_idx ON products(active, category);

-- chosen variant (e.g. colour or size) on a basket line
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_fabric_wood_metal_key;
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_line_key ON cart_items(cart_id, product_id, variant, fabric, wood, metal);

-- Oman delivery details and payment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_tbc BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS landmark TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ALTER COLUMN postcode SET DEFAULT '';

-- Showrooms (from the client's contact page)
CREATE TABLE IF NOT EXISTS stores (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  address    TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  whatsapp   TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  hours      TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL DEFAULT 'showroom',   -- showroom | office
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS style JSONB NOT NULL DEFAULT '{}'::jsonb; -- { wall, floor, photos }

-- ---------------------------------------------------------------- v5: AI 3D models from product photos
CREATE TABLE IF NOT EXISTS product_models (
  product_id   INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('queued', 'ready', 'failed')),
  provider     TEXT NOT NULL,
  model_id     TEXT NOT NULL,
  source_image TEXT NOT NULL,
  status_url   TEXT,
  response_url TEXT,
  file_name    TEXT,             -- data/models/<file_name>.glb once ready
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- v6: security hardening
-- A saved room is shared by link, so the link on its own must not grant write access.
-- Saving returns a secret edit token which PUT /api/rooms/:id requires; only its SHA-256
-- hash is kept here, so a database copy does not hand out edit rights. Rooms created
-- before this migration have no token and are read-only: the planner saves a copy of
-- them instead of overwriting.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS edit_token_hash TEXT;

-- Double opt-in. An address counts as subscribed only once it has confirmed, so anyone
-- can POST any address without that address ever receiving mail. Send only to rows
-- WHERE confirmed.
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirmed     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirm_token TEXT;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_token_idx ON newsletter(confirm_token)
  WHERE confirm_token IS NOT NULL;

-- Salted hash of the submitter's IP address -- never the address itself -- so review
-- floods can be traced and cleaned up without storing personal data.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ip_hash TEXT;
CREATE INDEX IF NOT EXISTS reviews_ip_idx ON reviews(ip_hash);

-- Fixed-window rate limiting for the public write endpoints. One row per
-- "<action>:<hashed caller>"; see src/lib/rate-limit.ts. Holds no personal data.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     TEXT PRIMARY KEY,
  hits       INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits(expires_at);

-- Retention: npm run db:cleanup deletes abandoned carts and stale rows (see scripts/db-cleanup.ts).
CREATE INDEX IF NOT EXISTS carts_updated_idx ON carts(updated_at);

-- ---------------------------------------------------------------- v7: admin panel
-- Staff accounts for the back office. There is no public sign-up: accounts are created
-- with `npm run admin:create`. Passwords are scrypt hashes from node:crypto
-- (format: scrypt$N$r$p$salt$hash), so no password library is needed.
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
  active        BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Login sessions. The cookie carries a random token; only its SHA-256 hash is stored
-- here (same reasoning as rooms.edit_token_hash above), so a copy of this table does
-- not hand out live sessions. Deleting a row logs that browser out immediately.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash    TEXT PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx    ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at);

-- orders.status goes live. It defaulted to 'awaiting_payment' and was never read or
-- written, which is wrong for cash on delivery: the money arrives at handover. Existing
-- rows are migrated first, then the column is constrained to the real workflow.
-- placed -> confirmed -> dispatched -> delivered -> returned, cancellable before delivery.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE orders SET status = 'placed' WHERE status = 'awaiting_payment';
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'placed';
-- DROP then ADD keeps this re-runnable: Postgres has no ADD CONSTRAINT IF NOT EXISTS.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD  CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned'));

-- Audit trail: which staff member moved an order, when, and why. admin_user_id uses
-- ON DELETE SET NULL so removing a member of staff does not delete history rows -- but
-- that alone would erase *who* acted, so the name is also copied in at insert time.
CREATE TABLE IF NOT EXISTS order_events (
  id            SERIAL PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name    TEXT NOT NULL DEFAULT '',
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE order_events ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at);

-- Indexes for the admin order list: newest first, and filtered by status.
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx  ON orders(status, created_at DESC);

-- Phone search. A plain index on orders(phone) would never be used: validation.ts accepts
-- "+968 9123 4567", "00968 91234567" and "9123 4567", all stored verbatim, so no single
-- literal matches them. Index the last 8 digits instead (the Omani subscriber number) and
-- search by equality on that. regexp_replace/right are IMMUTABLE, so this is indexable.
DROP INDEX IF EXISTS orders_phone_idx;
CREATE INDEX IF NOT EXISTS orders_phone_digits_idx
  ON orders (right(regexp_replace(phone, '\D', '', 'g'), 8));

-- ---------------------------------------------------------------- v8: product management
-- Numeric stock. in_stock stays exactly what it was -- the switch the storefront reads
-- (shop page, product page, dashboard) -- so nothing on the shop changes meaning here.
-- stock_qty is the optional count behind it: NULL means "not counted, just use the
-- switch", which is the right default for the 632 imported products. When a count IS
-- kept, src/lib/admin/products.ts derives in_stock from it so the two cannot disagree.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_qty INTEGER CHECK (stock_qty IS NULL OR stock_qty >= 0);

-- A second taxonomy level under category. Nothing on the storefront filters by it yet,
-- so it is purely an admin field until the shop page gains a control for it.
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';

-- Who changed a product, when, and what moved -- same shape and reasoning as
-- order_events: admin_user_id is SET NULL on staff deletion, so the name is copied in at
-- insert time or the history would lose *who* acted. `changes` holds
-- { field: [before, after] } for exactly the fields that actually differed.
CREATE TABLE IF NOT EXISTS product_events (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_slug  TEXT NOT NULL DEFAULT '',
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name    TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'restored', 'deleted')),
  changes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_events_product_idx ON product_events(product_id, created_at DESC);

-- Admin product search. Both are lower() expression indexes because the admin list
-- matches case-insensitively, and a plain index on the column would not be used.
CREATE INDEX IF NOT EXISTS products_name_lower_idx ON products (lower(name));
CREATE INDEX IF NOT EXISTS products_sku_lower_idx  ON products (lower(sku)) WHERE sku <> '';

-- ---------------------------------------------------------------- v9: moderation inbox
-- Review moderation. Anyone can post a review from the product page, so until now a
-- stranger could put any text and any star rating straight onto the storefront -- and
-- into the aggregateRating that search engines read.
--
-- The two-step default is deliberate, and matches what v7 did for orders.status: the
-- column is added defaulting to 'approved' so every review that is ALREADY live stays
-- live, and only then does the default change to 'pending' so newly submitted ones wait
-- for a human. Reversing these two statements would silently empty every product page.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD  CONSTRAINT reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at   TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderator_name TEXT NOT NULL DEFAULT '';
-- The storefront reads approved reviews per product; the admin queue reads pending ones.
CREATE INDEX IF NOT EXISTS reviews_status_idx  ON reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_product_ok_idx ON reviews(product_id) WHERE status = 'approved';

-- Inquiry inbox. The table has existed since v1 but nothing ever read it, so quote
-- requests from the product configurator have been accumulating unseen.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE inquiries ADD  CONSTRAINT inquiries_status_check
  CHECK (status IN ('new', 'answered', 'closed'));
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS admin_note    TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS handled_at    TIMESTAMPTZ;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS handled_by    INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS handler_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS ip_hash       TEXT;
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status, created_at DESC);

-- Newsletter: v6 added `confirmed`/`confirm_token` but nothing ever issued or checked a
-- token. Existing rows predate double opt-in, so they are grandfathered as confirmed
-- rather than silently dropped from a list the owner believes they have.
UPDATE newsletter SET confirmed = true, confirmed_at = COALESCE(confirmed_at, created_at)
 WHERE confirmed = false AND confirm_token IS NULL;
CREATE INDEX IF NOT EXISTS newsletter_confirmed_idx ON newsletter(confirmed, created_at DESC);

-- ---------------------------------------------------------------- v10: editable site content
-- Every editable piece of the storefront that is not a product, an order or a review.
--
-- One row per named block rather than a table per section. The alternative -- a bespoke
-- table for the hero, another for the footer, another for the nav -- would mean a
-- migration, a query and an admin form for each, and the sections are plain content with
-- no relationships to model. The shape of each block is defined and validated in
-- src/lib/content/blocks.ts, which also holds the DEFAULT for every block, copied from
-- the values that were hardcoded in the components.
--
-- That default is what makes this safe to deploy: a block with no row here renders
-- exactly what it rendered before, so the storefront does not change until the owner
-- actually edits something. Deleting a row is therefore a working "reset to original".
CREATE TABLE IF NOT EXISTS site_content (
  key          TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  updater_name TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------- v11: product video
-- One optional video per product, set by the admin (uploaded, or an address pasted in).
-- Empty string, never NULL, so the storefront's "does this product have a video?" test is
-- a plain truthiness check and never has to worry about three states.
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------- catalogue data
BEGIN;
DELETE FROM reviews WHERE is_demo;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (1, 'boucle-ivory', 'Bouclé Ivory', 'fabric', '#e8e0d2', 'Looped wool, Italy', 0) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (2, 'sage-linen', 'Sage Linen', 'fabric', '#9aa78c', 'Washed Belgian linen', 1) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (3, 'terracotta-velvet', 'Terracotta Velvet', 'fabric', '#b65a3a', 'Cotton velvet', 2) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (4, 'midnight-wool', 'Midnight Wool', 'fabric', '#2c3447', 'Felted merino', 3) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (5, 'ochre-chenille', 'Ochre Chenille', 'fabric', '#c9963d', 'Soft-touch chenille', 4) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (6, 'white-oak', 'White Oak', 'wood', '#d2b48c', 'FSC European oak', 5) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (7, 'smoked-walnut', 'Smoked Walnut', 'wood', '#6b4a33', 'American black walnut', 6) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (8, 'ebonized-ash', 'Ebonized Ash', 'wood', '#2a2522', 'Iron-stained ash', 7) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (9, 'brushed-steel', 'Brushed Steel', 'metal', '#b9b8b4', 'Satin finish', 8) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (10, 'aged-brass', 'Aged Brass', 'metal', '#b08d57', 'Living finish', 9) ON CONFLICT DO NOTHING;
INSERT INTO public.materials (id, slug, name, role, hex, note, sort_order) VALUES (11, 'black-steel', 'Black Steel', 'metal', '#2b2b2b', 'Powder coat', 10) ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (1, 'loma-sofa', 'Loma Sofa', 'sofa', 'A deep, low three-seater built to be lived on.', 'Kiln-dried oak frame, eight-way hand-tied springs and feather-wrapped cushions. Every Loma is assembled by one maker from first joint to final stitch.', 299500, 8, 210, 90, 82, 0, '2026-10-17 23:12:42.527122+05', 'seating', '{"Kiln-dried solid oak frame with mortise-and-tenon joints","Eight-way hand-tied steel springs","Feather-wrapped high-resilience foam cushions","Removable, dry-cleanable covers","Seat height 44 cm · seat depth 62 cm"}', 'Plump cushions weekly. Vacuum with a soft brush. Blot spills immediately; professional clean only.', '{living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (2, 'ondo-lounge-chair', 'Ondo Lounge Chair', 'armchair', 'The reading chair, reconsidered.', 'A slightly reclined back and wide arms make Ondo the chair you finish the book in. Removable covers, solid timber base.', 129500, 6, 86, 84, 80, 1, '2026-10-17 23:12:42.527122+05', 'seating', '{"Solid timber base, oiled by hand","Back reclined at 12° for reading","Pocket-sprung seat cushion","Removable covers with concealed zips"}', 'Rotate the seat cushion monthly. Vacuum gently. Re-oil the base once a year.', '{living,bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (3, 'halo-coffee-table', 'Halo Coffee Table', 'coffeeTable', 'Two discs of solid timber, one quiet idea.', 'A round top and a floating lower shelf on three slender steel legs. Oiled by hand and finished with a hard wax.', 69500, 5, 90, 90, 38, 2, '2026-10-17 23:12:42.527122+05', 'tables', '{"Solid timber top, 40 mm thick","Floating lower shelf","Powder-coated steel legs with felt glides","Hard-wax oil finish, food safe"}', 'Wipe with a damp cloth. Use coasters for hot drinks. Refresh with hard-wax oil when the surface looks dry.', '{living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (4, 'vela-floor-lamp', 'Vela Floor Lamp', 'floorLamp', 'Evening light, woven.', 'A linen shade on a brushed steel stem. Dimmable warm LED tuned to 2700K so the room glows instead of glares.', 37900, 3, 48, 48, 160, 3, '2026-10-17 23:12:42.527122+05', 'lighting', '{"Hand-sewn Belgian linen shade","Brushed steel stem, weighted base","Dimmable 2700K LED, E27 fitting","Foot switch, 2.5 m fabric cable"}', 'Dust the shade with a lint roller. Switch off and let the bulb cool before handling.', '{living,bedroom,office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (5, 'arca-bookshelf', 'Arca Bookshelf', 'bookshelf', 'Five shelves, zero screws.', 'Joined entirely with wedged through-tenons. Arca knocks down flat for moving day and goes back together in minutes.', 99500, 7, 90, 32, 180, 4, '2026-10-17 23:12:42.527122+05', 'storage', '{"Five shelves, each rated to 30 kg","Wedged through-tenon joinery, no screws","Knocks down flat in under 10 minutes","Wall strap included"}', 'Dust weekly. Always use the wall strap. Keep out of direct radiator heat.', '{living,office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (6, 'pip-side-table', 'Pip Side Table', 'sideTable', 'A small table for a cup and a good book.', 'A turned timber top on a steel pedestal. Light enough to carry from sofa to bedside.', 26900, 3, 48, 48, 55, 5, '2026-10-17 23:12:42.527122+05', 'tables', '{"Turned solid timber top","Steel pedestal and weighted base","Weighs 6 kg, easy to carry"}', 'Wipe with a damp cloth. Avoid standing water on the timber.', '{living,bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (25, 'bruma-corner-sofa', 'Bruma Corner Sofa', 'sectional', 'A corner sofa with a chaise long enough to stretch out on.', 'The Loma''s deep seat, extended into an L. The chaise sits on the right as standard; ask the studio for a left-hand build.', 449500, 10, 270, 162, 82, 6, '2026-10-18 00:12:10.969834+05', 'seating', '{"Right-hand chaise as standard","Kiln-dried oak frame, hand-tied springs","Feather-wrapped seat cushions","Seat depth 62 cm · chaise length 142 cm"}', 'Plump and rotate cushions weekly. Vacuum with a soft brush. Professional clean only.', '{living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (26, 'linea-media-console', 'Linea Media Console', 'mediaConsole', 'Low, long and quiet — hides every cable.', 'Three push-to-open doors, adjustable shelves and a cable channel in the back panel. Holds screens up to 85 inches.', 129500, 7, 180, 42, 50, 7, '2026-10-18 00:12:10.969834+05', 'storage', '{"Three push-to-open doors","Adjustable shelves","Rear cable channel","Takes screens up to 85 in / 60 kg"}', 'Dust with a dry cloth. Keep ventilation gaps clear behind electronics.', '{living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (28, 'terra-wool-rug', 'Terra Wool Rug', 'rug', 'Hand-tufted wool with a quiet border.', 'Dense New Zealand wool, hand-tufted and finished with a contrast border. 200 × 300 cm.', 94900, 6, 200, 300, 1, 9, '2026-10-18 00:12:10.969834+05', 'decor', '{"100% New Zealand wool pile","Hand-tufted, cotton backing","200 × 300 cm, 12 mm pile"}', 'Vacuum weekly without the beater bar. Rotate every six months. Professional clean once a year.', '{living,bedroom,dining}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (29, 'vale-console-table', 'Vale Console Table', 'consoleTable', 'For keys, post and a good lamp by the door.', 'A slim timber top and lower shelf on a fine steel frame. Only 35 cm deep, so it fits narrow hallways.', 54900, 5, 120, 35, 78, 10, '2026-10-18 00:12:10.969834+05', 'tables', '{"Only 35 cm deep","Lower shelf for baskets or shoes","Wall-fixing bracket included"}', 'Wipe with a damp cloth. Use felt pads under ceramics.', '{living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (30, 'sora-bed', 'Sora King Bed', 'bed', 'An upholstered headboard on a solid timber frame.', 'UK king size — fits a standard 150 × 200 cm king mattress. Solid slats, centre support rail and a padded headboard for reading in bed. Mattress sold separately; double and super king built to order.', 189500, 8, 164, 213, 108, 11, '2026-10-18 00:12:10.969834+05', 'beds', '{"UK king size — fits a standard 150 × 200 cm mattress","Double (135 × 190) and super king (180 × 200) made to order","Solid timber slats with centre rail","Upholstered headboard, 108 cm high","Under-bed clearance 14 cm"}', 'Vacuum the headboard monthly. Tighten frame bolts once a year.', '{bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (31, 'sora-bedside-table', 'Sora Bedside Table', 'nightstand', 'Two soft-close drawers at just the right height.', 'Sized to sit level with the Sora mattress. Dovetailed drawers run on soft-close runners.', 44900, 6, 50, 40, 55, 12, '2026-10-18 00:12:10.969834+05', 'tables', '{"Two dovetailed drawers","Soft-close runners","Top sits level with the Sora mattress"}', 'Wipe with a damp cloth. Use a coaster for water glasses.', '{bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (32, 'mara-dresser', 'Mara Six-Drawer Dresser', 'dresser', 'Six deep drawers, dovetailed by hand.', 'Hand-cut dovetails on every drawer box and solid timber runners. Anti-tip strap included.', 149500, 8, 120, 50, 82, 13, '2026-10-18 00:12:10.969834+05', 'storage', '{"Six hand-dovetailed drawers","Solid timber runners","Anti-tip wall strap included"}', 'Dust weekly. Always fit the wall strap. Re-oil the top yearly.', '{bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (33, 'mara-wardrobe', 'Mara Wardrobe', 'wardrobe', 'Hanging rail, shelves and doors that close with a whisper.', 'A full-height hanging rail on one side and five shelves on the other. Delivered flat and assembled in your room.', 219500, 9, 100, 62, 203, 14, '2026-10-18 00:12:10.969834+05', 'storage', '{"Full-height hanging rail","Five adjustable shelves","Soft-close hinges","Assembled in your room by our team"}', 'Dust weekly. Keep away from damp external walls.', '{bedroom}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (34, 'aura-floor-mirror', 'Aura Floor Mirror', 'mirror', 'A full-length mirror that leans, framed in solid timber.', 'Copper-free silvered glass in a solid timber frame. Leans against the wall with a hidden safety strap.', 47900, 4, 70, 30, 180, 15, '2026-10-18 00:12:10.969834+05', 'decor', '{"Copper-free silvered glass","Solid timber frame","Hidden wall safety strap"}', 'Clean glass with a soft cloth and glass cleaner sprayed onto the cloth, never onto the frame.', '{bedroom,living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (35, 'kiri-bench', 'Kiri Bench', 'bench', 'At the foot of the bed or along the dining table.', 'An upholstered seat on a solid timber frame with panel legs. Seats two at a table.', 54900, 5, 120, 40, 45, 16, '2026-10-18 00:12:10.969834+05', 'seating', '{"Seats two at a dining table","Upholstered seat pad","Solid panel legs and stretcher"}', 'Vacuum the seat. Wipe the frame with a damp cloth.', '{bedroom,dining}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (36, 'luma-table-lamp', 'Luma Table Lamp', 'tableLamp', 'A small pool of warm light for the bedside or desk.', 'A solid metal ball base with a linen shade. Dimmable warm LED, inline switch.', 19900, 3, 30, 30, 46, 17, '2026-10-18 00:12:10.969834+05', 'lighting', '{"Linen shade","Solid metal base","Dimmable 2700K LED, inline switch"}', 'Dust the shade with a lint roller.', '{bedroom,living,office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (37, 'fen-dining-table', 'Fen Dining Table', 'diningTable', 'Seats six, built to be handed down.', 'A 40 mm solid timber top on a mortise-and-tenon base. Seats six comfortably, eight at a squeeze.', 209500, 9, 180, 90, 75, 18, '2026-10-18 00:12:10.969834+05', 'tables', '{"Seats six (eight at a squeeze)","40 mm solid timber top","Mortise-and-tenon base","Leg clearance 67 cm"}', 'Use mats for hot dishes. Wipe spills straight away. Re-oil every 6–12 months.', '{dining}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (38, 'fen-dining-chair', 'Fen Dining Chair', 'diningChair', 'A padded seat for long dinners.', 'Solid timber frame, curved back rail and an upholstered seat. Stackable two high for storage.', 32900, 6, 46, 50, 83, 19, '2026-10-18 00:12:10.969834+05', 'seating', '{"Upholstered seat","Curved solid back rail","Stacks two high","Seat height 48 cm"}', 'Vacuum the seat. Wipe the frame with a damp cloth.', '{dining,office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (39, 'fen-sideboard', 'Fen Sideboard', 'sideboard', 'Four doors for plates, glasses and the good linen.', 'Adjustable shelves behind four solid doors. Cutlery tray included in the left cupboard.', 174900, 8, 160, 45, 80, 20, '2026-10-18 00:12:10.969834+05', 'storage', '{"Four solid doors","Adjustable shelves","Cutlery tray included"}', 'Dust weekly. Use mats under vases and plants.', '{dining,living}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (40, 'tali-counter-stool', 'Tali Counter Stool', 'barStool', 'A round timber seat for the kitchen island.', 'Seat height 74 cm for standard kitchen counters. Steel frame with a footrest on all four sides.', 22900, 4, 38, 38, 76, 21, '2026-10-18 00:12:10.969834+05', 'seating', '{"Seat height 74 cm for standard 90 cm worktops","Footrest on all four sides","Felt floor glides"}', 'Wipe with a damp cloth. Re-oil the seat yearly.', '{dining}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (41, 'atlas-desk', 'Atlas Desk', 'desk', 'A clear desk with one good drawer.', 'A deep solid timber top on slim steel legs, with a single drawer for the things that clutter a desk.', 99500, 6, 140, 70, 75, 22, '2026-10-18 00:12:10.969834+05', 'tables', '{"Deep 70 cm top for two screens","Single drawer","Rear cable gap"}', 'Use a desk mat under a mouse. Re-oil the top yearly.', '{office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (42, 'atlas-task-chair', 'Atlas Task Chair', 'officeChair', 'All-day support that doesn''t look like office furniture.', 'Height-adjustable seat, tilting back and padded arms, upholstered in Atelier fabrics instead of mesh.', 69900, 5, 62, 62, 108, 23, '2026-10-18 00:12:10.969834+05', 'seating', '{"Gas-lift height adjustment","Tilting, lockable back","Padded arms","Soft casters for hard floors"}', 'Vacuum the upholstery. Wipe the base with a damp cloth.', '{office}') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, slug, name, kind, tagline, description, price_cents, lead_time_weeks, width_cm, depth_cm, height_cm, sort_order, created_at, category, details, care, rooms) VALUES (27, 'nido-pouf', 'Nido Pouf', 'pouf', 'Footrest, extra seat, side table — whatever the evening needs.', 'A firm, round pouf on a turned timber base. Upholstered in any Atelier fabric.', 29900, 4, 56, 56, 42, 8, '2026-10-18 00:12:10.969834+05', 'seating', '{"High-density foam core","Turned timber base","Covered button top"}', 'Vacuum gently. Blot spills immediately.', '{living,bedroom}') ON CONFLICT DO NOTHING;
SELECT pg_catalog.setval('public.materials_id_seq', 77, true);
SELECT pg_catalog.setval('public.products_id_seq', 114, true);
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (39, 1, 'Sample reviewer', 5, 'Deep enough to nap on', 'The seat depth is generous and the cushions keep their shape. Delivery team assembled it in ten minutes.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (40, 1, 'Sample reviewer', 4, 'Beautiful linen', 'Sage linen is softer than the swatch suggested. Took eight weeks as promised.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (41, 2, 'Sample reviewer', 5, 'My reading chair now', 'The recline is just right and the arms are wide enough for a mug.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (42, 3, 'Sample reviewer', 5, 'Solid and calm', 'Heavier than it looks, in a good way. The lower shelf holds all our books.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (43, 4, 'Sample reviewer', 4, 'Warm evening light', 'Exactly the glow we wanted. I''d like a slightly longer cable.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (44, 5, 'Sample reviewer', 5, 'No tools needed', 'Went together in minutes and feels rock solid with the wall strap.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (45, 30, 'Sample reviewer', 5, 'Best sleep in years', 'Solid, silent frame and the headboard is perfect for reading.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (46, 37, 'Sample reviewer', 5, 'The centre of our home', 'We fit eight at Christmas. The oak top is beautiful.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (47, 32, 'Sample reviewer', 4, 'Drawers glide perfectly', 'Lovely joinery. Took nine weeks rather than eight.', true, '2026-10-18 23:54:19.180226+05');
INSERT INTO public.reviews (id, product_id, author, rating, title, body, is_demo, created_at) VALUES (48, 42, 'Sample reviewer', 4, 'Comfortable and good looking', 'Doesn''t look like office furniture, which was the point.', true, '2026-10-18 23:54:19.180226+05');
SELECT setval('reviews_id_seq', (SELECT coalesce(max(id),1) FROM reviews));
COMMIT;

SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM materials) AS materials, (SELECT count(*) FROM reviews) AS reviews;
