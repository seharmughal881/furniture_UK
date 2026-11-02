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
npm run db:setup                # creates tables + loads the catalogue (safe to re-run)
npm run dev                     # http://localhost:3000
```

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

The store is set up for the **UK market** (GBP inc. VAT, UK addresses, UK consumer law wording).
See **[docs/UK-MARKET.md](docs/UK-MARKET.md)** for the researched requirements, sources and the client's launch checklist.


- **Payments:** checkout saves orders with status `awaiting_payment` and says "demo — no payment taken".
  Connect Stripe Checkout (or similar) in `src/app/api/checkout/route.ts` and remove the demo banners.
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
- **PostgreSQL** via `pg` — schema in `db/schema.sql` (`products`, `materials`, `reviews`, `carts`, `cart_items`,
  `orders`, `order_items`, `rooms`, `inquiries`, `newsletter`).
- **3D: three.js + React Three Fiber + drei.** A single fixed WebGL canvas (`CanvasRoot`) renders every viewport
  on every page through drei `<View>`, so there is one GL context no matter how many 3D scenes are on screen.

| File | Role |
|---|---|
| `src/three/furniture.ts` | All 24 furniture models defined as data (lists of parts), plus footprints, heights, labels and material roles. Add a piece here. |
| `src/three/Furniture.tsx` | Renders a piece; drives assembly, blueprint edges, explode, lamp glow. |
| `src/three/materials.ts` | Shader-patched materials: reveal dissolve, colour sweep, matching shadow depth; procedural wood/weave textures. |
| `src/three/daylight.ts` | Hour → sun direction/colour, ambient, sky colours, lamp glow. |
| `src/components/home/HeroStory.tsx` | Scroll story, camera path, chapters. |

Tested at 60 fps on an Intel UHD 620 integrated GPU.
# furniture_UK
