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

-- ---------------------------------------------------------------- v12: cart note, shipping estimate, coupons
-- The three things the basket drawer can now do, mirroring what customers already expect
-- from the shops they buy from: leave a note with the order, check what delivery costs
-- before committing, and redeem a discount code.
--
-- All three hang off `carts` rather than being held in the browser, for one reason: the
-- price charged must be computed from rows the customer cannot edit. A coupon kept in
-- localStorage is a coupon the customer can mint.

-- A free-text message the customer attaches to the basket ("please call before 6pm",
-- "deliver to the villa gate"). Empty string, never NULL, so every read is a plain
-- truthiness test -- the same convention products.video_url uses.
ALTER TABLE carts  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT '';

-- The governorate the shopper picked in the drawer's shipping estimator. Remembered so
-- the checkout form can prefill it, and so the quote survives a page reload. It is only
-- ever a hint: /api/checkout recomputes delivery from the address actually submitted.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS ship_governorate TEXT NOT NULL DEFAULT '';

-- Delivery terms per governorate.
--
-- A table rather than a constant, because these are the client's commercial terms and
-- they differ by distance: Musandam is an exclave reached through the UAE, Al Wusta is
-- mostly desert, and both cost more to reach than Bawshar. The storefront previously had
-- one nationwide rule (free over OMR 75, otherwise "we'll confirm by phone"), which is
-- what every row is seeded with, so behaviour does not change until the owner edits a row.
--
-- fee_cents NULL is meaningful and is the seeded value: "we cannot quote this from a
-- table, the team confirms it by phone". That is the client's actual published policy --
-- the fee depends on weight as well as destination -- so inventing a number here would
-- put a price on the website that the business has never agreed to charge.
CREATE TABLE IF NOT EXISTS shipping_zones (
  governorate     TEXT PRIMARY KEY,
  fee_cents       INTEGER,
  free_over_cents INTEGER NOT NULL DEFAULT 75000,
  min_days        INTEGER NOT NULL DEFAULT 4,
  max_days        INTEGER NOT NULL DEFAULT 6,
  active          BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shipping_zones DROP CONSTRAINT IF EXISTS shipping_zones_sane_check;
ALTER TABLE shipping_zones ADD  CONSTRAINT shipping_zones_sane_check
  CHECK (
    (fee_cents IS NULL OR (fee_cents >= 0 AND fee_cents <= 100000)) AND
    free_over_cents >= 0 AND
    min_days >= 0 AND max_days >= min_days AND max_days <= 90
  );

INSERT INTO shipping_zones (governorate) VALUES
  ('Muscat'), ('Dhofar'), ('Musandam'), ('Al Buraimi'), ('Ad Dakhiliyah'),
  ('North Al Batinah'), ('South Al Batinah'), ('South Ash Sharqiyah'),
  ('North Ash Sharqiyah'), ('Ad Dhahirah'), ('Al Wusta')
ON CONFLICT (governorate) DO NOTHING;

-- Discount codes.
--
-- `code` is stored already upper-cased and is the primary key of the lookup, so there is
-- exactly one spelling of a code in the database and "welcome10" and "WELCOME10" cannot
-- become two different coupons with two different budgets.
CREATE TABLE IF NOT EXISTS coupons (
  id                 SERIAL PRIMARY KEY,
  code               TEXT NOT NULL,
  kind               TEXT NOT NULL,
  -- percent: 1-100. fixed: baisa off. free_shipping: unused, kept 0.
  value              INTEGER NOT NULL DEFAULT 0,
  -- The basket must reach this before the code is accepted (0 = no minimum).
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  -- A percentage discount on a bedroom set can be a lot of money; this caps the damage.
  -- NULL = uncapped.
  max_discount_cents INTEGER,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  -- Total redemptions allowed across all customers. NULL = unlimited.
  max_redemptions    INTEGER,
  -- Incremented inside the checkout transaction, never when a code is merely applied to a
  -- basket -- see redeemCoupon() in src/lib/coupons.ts.
  redemptions        INTEGER NOT NULL DEFAULT 0,
  -- When true a given phone number may redeem this code once, ever.
  once_per_customer  BOOLEAN NOT NULL DEFAULT false,
  active             BOOLEAN NOT NULL DEFAULT true,
  note               TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON coupons(code);
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_kind_check;
ALTER TABLE coupons ADD  CONSTRAINT coupons_kind_check
  CHECK (kind IN ('percent', 'fixed', 'free_shipping'));
-- The value must make sense for the kind. A 150% discount or a negative one would pay the
-- customer to shop here, and neither the API nor the admin form is the last line of
-- defence -- this is.
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_value_check;
ALTER TABLE coupons ADD  CONSTRAINT coupons_value_check
  CHECK (
    (kind = 'percent'       AND value BETWEEN 1 AND 100) OR
    (kind = 'fixed'         AND value BETWEEN 1 AND 100000000) OR
    (kind = 'free_shipping' AND value = 0)
  );
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_window_check;
ALTER TABLE coupons ADD  CONSTRAINT coupons_window_check
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_limits_check;
ALTER TABLE coupons ADD  CONSTRAINT coupons_limits_check
  CHECK (
    min_subtotal_cents >= 0 AND
    redemptions >= 0 AND
    (max_redemptions IS NULL OR max_redemptions >= 1) AND
    (max_discount_cents IS NULL OR max_discount_cents >= 1)
  );

-- ON DELETE SET NULL, not CASCADE: deleting a finished promotion must never delete the
-- basket it was attached to.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;

-- Orders keep their own copy of the code and the money taken off. The coupon row may be
-- edited or deleted next month; what this customer was actually charged may not change.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code    TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_discount_check;
ALTER TABLE orders ADD  CONSTRAINT orders_discount_check
  CHECK (discount_cents >= 0 AND discount_cents <= subtotal_cents);

-- One row per successful redemption: the audit trail behind coupons.redemptions, and what
-- makes once_per_customer enforceable.
--
-- phone_hash, not the phone number. Reusing bucketFor() from rate-limit.ts means the same
-- salted SHA-256 as everywhere else in this codebase, so a leak of this table reveals no
-- customer's number, and the uniqueness check still works because the same number always
-- hashes the same way.
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id             SERIAL PRIMARY KEY,
  coupon_id      INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id       UUID    NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
  phone_hash     TEXT NOT NULL,
  discount_cents INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON coupon_redemptions(coupon_id, created_at DESC);
-- Partial, and the partiality is the whole mechanism.
--
-- phone_hash is written ONLY for a coupon with once_per_customer set; every other
-- redemption stores '' and is therefore outside this index. A unique index over every row
-- would wrongly stop a repeat customer using a general "10% off everything" code twice,
-- and storing the hash regardless would keep a per-customer record this shop has no use
-- for. So the index enforces the rule for the coupons that asked for it, and the rows for
-- the rest hold no customer identifier at all.
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_once_key
  ON coupon_redemptions(coupon_id, phone_hash)
  WHERE phone_hash <> '';
