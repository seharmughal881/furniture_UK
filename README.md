# Muscat Furniture — 3D furniture store for Oman

> Built on the "Atelier" 3D engine. The live catalogue (632 products) is imported from the client's Shopify store,
> muscatfurniture.com. See `docs/MUSCAT-MARKET-ANALYSIS.md` for the competitor analysis.

## Sync the catalogue from Shopify

```bash
npm run import:muscat            # import the saved snapshot in data/muscat-import
npm run import:muscat -- --fetch # download the latest products from muscatfurniture.com, then import
```

The client keeps managing products, prices and stock in Shopify; re-run the import (or schedule it) to update this site.

## AI 3D models of real products (room planner)

The planner can turn each product photo into a real 3D model of that exact piece, using an
image-to-3D AI model on fal.ai (default: Hunyuan 3D 2.1). Each product is generated **once**; the GLB
is downloaded to `data/models/` and served from `/api/models/<slug>/file`, so it is instant afterwards.

1. Create a key at https://fal.ai/dashboard/keys and add it to `.env.local` (never commit it):
   `FAL_KEY=...`  (optional: `FAL_3D_MODEL`, `MAX_3D_PER_DAY` — see `.env.example`)
2. Pre-generate every furniture product so customers never wait:
   `npm run models:generate`  (or `npm run models:generate -- dublin preston-dresser`, `-- --retry`)
3. Restart the server. Without a key the planner falls back to product photos / simple 3D.

Best results come from photos of the product alone on a white background.

### Free option (no API key, no payment): Google Colab + TripoSR

1. `npm run models:list` → writes `data/models-jobs.json` (furniture products without a 3D model yet).
2. Open `tools/make-3d-models-colab.ipynb` in https://colab.research.google.com (File → Upload notebook),
   choose **Runtime → Change runtime type → T4 GPU**, and run the cells. Upload `models-jobs.json` when asked.
   It converts every photo with TripoSR (MIT licence) and downloads `muscat-3d-models.zip`.
3. `npm run models:import -- ~/Downloads/muscat-3d-models.zip` → the planner shows them as real 3D models.

---

## Original 3D engine notes

A furniture showroom rendered live with three.js. Nothing is a photo or a downloaded 3D model:
every piece is generated in code, so it can assemble itself, change material and be lit at any hour.

## Run it

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL to your PostgreSQL
npm run db:setup                # creates tables + loads the seed catalogue (safe to re-run)
npm run import:muscat           # loads the real 632-product catalogue AND the showrooms
npm run dev                     # http://localhost:3000
```

`import:muscat` is not optional for a fresh database: it is the only thing that fills the
`stores` table, and `/stores/[slug]` uses `generateStaticParams`, which under Cache
Components must return at least one row — so `npm run build` fails on a database that has
only had `db:setup`. Requires PostgreSQL 13 or newer.

### Updating an existing database

`db:setup` is for a *fresh* database: it also upserts the 24 demo seed products, which you do
not want in a live shop. To bring an existing database (Neon, staging) up to the current
schema and change nothing else:

```bash
DATABASE_URL="postgres://...neon.tech/..." npm run db:migrate
```

It applies `db/schema.sql` in one transaction, is safe to re-run, and seeds nothing. Run it
after every pull that touches `db/schema.sql` — a database missing a newer column fails at
runtime with Postgres error `42703` (for example `column "video_url" does not exist`), while
the build itself still succeeds, because the build only type-checks the query, never runs it
against your deployed database.

Housekeeping: `npm run db:cleanup` drops expired rate-limit buckets and sessions, abandoned
baskets and unconfirmed newsletter sign-ups. Run it on a daily schedule in production.

## What's on screen

| Where | Experience |
|---|---|
| `/` hero, chapter 1 | The Loma sofa starts as an exploded blueprint on navy; scrolling flies the 21 parts together and they materialise through a glowing dissolve. |
| `/` hero, chapter 2 | Material lab — pick a fabric/timber and the new colour sweeps organically across the sofa. |
| `/` hero, chapter 3 | A day in the life — scrolling moves the sun from 13:00 to 22:00; shadows sweep, the sky changes, the lamp switches on. |
| `/` shop by room | Living room, Bedroom, Dining and Home office tiles, each a small live 3D scene. |
| `/` favourites | Live 3D cards from PostgreSQL. Hover pulls a piece apart to show its joinery. |
| `/product/[slug]` | Orbit, exploded-view slider, time-of-day slider, materials, quote request (saved to `inquiries`). |
| `/planner` | Start from a Living / Bedroom / Dining / Office preset (`?preset=bedroom`), drag pieces, rotate (R) / delete, table lamps sit on tables automatically, change the hour, save → shareable `?room=<uuid>` link. |

## Store features

| Area | What a customer gets |
|---|---|
| Header | Announcement bar, Shop mega-menu, search (⌘/Ctrl+K), cart counter, full-screen mobile menu |
| `/shop` | Category, price and sort filters in the URL (shareable, crawlable, work without JavaScript) |
| Product | Breadcrumbs, ratings, camera presets, 3D dimension guides, quantity, add to cart, delivery estimate, details/care/delivery accordions, trade quote form, reviews with write-a-review, related products, sticky mobile buy bar, Product JSON-LD |
| Cart | Server-side cart (httpOnly cookie), slide-in drawer, quantity edits, free-delivery progress bar |
| `/checkout` → `/order/[id]` | Address + delivery method, server-calculated totals, order saved in one transaction, confirmation page |
| Planner | "Add room to cart" turns a planned room into an order |
| Site | `/help`, `/legal`, 404 and error pages, `sitemap.xml`, `robots.txt`, adaptive 3D quality, no-WebGL fallback, reduced-motion support |

### Before going live

The store is set up for the **Omani market**: prices in Omani rials (integer baisa, 1 OMR =
1000 baisa, shown to 3 decimals and inclusive of Oman's 5% VAT), Omani phone validation, and
governorate/wilaya/area addresses rather than postcodes. See
**[docs/MUSCAT-MARKET-ANALYSIS.md](docs/MUSCAT-MARKET-ANALYSIS.md)** for the competitor
research. `docs/UK-MARKET.md` describes the earlier UK build and is kept only for history —
it no longer describes this store, and the `orders.county` / `orders.postcode` columns are
leftovers from it.

- **Payments:** checkout takes no money. Orders are saved with status `placed` and paid cash
  on delivery; the team phones to confirm. Card payments are stubbed for AmwalPay (all
  cards, Apple Pay, Bank Muscat EPP) — see the `AMWALPAY_*` keys in `.env.example`; with
  `AMWALPAY_MERCHANT_ID` empty the card option shows as "Coming soon" and cannot be chosen.
- **Delivery fee:** free over OMR 75; below that `deliveryFee()` returns `null`, the order is
  flagged `delivery_fee_tbc` and the fee is agreed by phone.
- **Stock:** `products.stock_qty` drives the `in_stock` flag but is never decremented when an
  order is placed, so it does not reserve anything. Decide whether that is wanted before
  relying on the back-office stock figures.
- **Sample reviews:** `DELETE FROM reviews WHERE is_demo;` (they are labelled "Sample review" on the site and
  are excluded from search-engine ratings).
- **Legal text** in `/legal` is placeholder copy — replace with reviewed policies.
- **Emails:** order confirmations and quote replies are not sent yet; add a mail provider (Resend, Postmark…).
- Set `NEXT_PUBLIC_SITE_URL` for correct sitemap and canonical URLs.
- Fill in the real company details in `src/lib/company.ts` (shown in the footer and on `/legal`).

## Architecture

- **Next.js 16 (App Router)** — one app for front-end and back-end. Pages are server components that read the
  catalogue straight from PostgreSQL (`'use cache'`, refreshed hourly).
- **Back-end: Node.js route handlers** in `src/app/api` — products, rooms, inquiries, cart (`/api/cart`,
  `/api/cart/items`, `/api/cart/items/:id`), `/api/checkout`, `/api/reviews`, `/api/newsletter`. Input validated with
  zod, SQL parameterised, prices always read from the database, cart edits scoped to the visitor's own cart.
- **PostgreSQL** via `pg` — the authoritative schema is `db/schema.sql`, which `npm run db:setup`
  applies (`products`, `materials`, `reviews`, `carts`, `cart_items`, `orders`, `order_items`,
  `rooms`, `inquiries`, `newsletter`, `stores`, `product_models`, `rate_limits`, `admin_users`,
  `admin_sessions`, `order_events`, `product_events`, `site_content`). `db/neon-setup.sql` is the
  paste-into-Neon version and is **generated** — run `npm run db:neon-sql` after changing the
  schema, never edit it by hand.
- **3D: three.js + React Three Fiber + drei.** A single fixed WebGL canvas (`CanvasRoot`) renders every viewport
  on every page through drei `<View>`, so there is one GL context no matter how many 3D scenes are on screen.

| File | Role |
|---|---|
| `src/three/furniture.ts` | All 24 furniture models defined as data (lists of parts), plus footprints, heights, labels and material roles. Add a piece here. |
| `src/three/FurniturePiece.tsx` | Renders a piece; drives assembly, blueprint edges, explode, lamp glow. |
| `src/three/materials.ts` | Shader-patched materials: reveal dissolve, colour sweep, matching shadow depth; procedural wood/weave textures. |
| `src/three/daylight.ts` | Hour → sun direction/colour, ambient, sky colours, lamp glow. |
| `src/components/home/HeroStory.tsx` | Scroll story, camera path, chapters. |

Tested at 60 fps on an Intel UHD 620 integrated GPU.
