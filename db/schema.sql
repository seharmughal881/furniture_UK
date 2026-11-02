-- Atelier schema. Safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
