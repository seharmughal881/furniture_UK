-- Atelier: full database setup for a new, empty PostgreSQL database (e.g. Neon).
-- Paste into Neon -> SQL Editor -> Run. Safe to run more than once.

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
