# Atelier for Muscat Furniture — market analysis, test results and feature list

Prepared 30 October 2026 for the Muscat Furniture website proposal.
Client's current site: **muscatfurniture.com** (Shopify). Competitors checked: IKEA Oman, Danube Home Oman,
Pan Home Oman. Home Centre and OC Home blocked automated reading, so they are listed as "not checked".

## 1. Summary

- **Our site does something no furniture website in Oman does:** every product is a live 3D model that builds
  itself, changes fabric instantly, and can be placed in a 3D room. None of the Oman sites checked show 3D,
  AR, 360° views or a room planner on their product pages. IKEA has separate "planning tools".
- **It is much lighter and faster than the client's current site.** The home page is 0.6 MB from 35
  requests, against 7.7 MB from 333 requests on muscatfurniture.com.
- **It is not ready for Oman yet.** It was built for the UK: pounds, 20% VAT, UK postcodes, English only. Before
  launch in Muscat it needs Arabic, OMR prices with 5% VAT, WhatsApp ordering, cash on delivery, Oman delivery
  areas, the client's real product catalogue and an admin panel. All are listed in section 6.

## 2. Test results (our site)

Automated browser test of every page and flow, run 30 October 2026 in Chrome on a production build.

| Area | Result |
|---|---|
| All 15 pages and API routes load | ✅ 15/15 |
| 3D hero: three scroll chapters, day-to-night clock | ✅ (works; first run's failures were a bug in the test script, re-checked by hand) |
| Search, mega menu, room and type filters | ✅ |
| Product page: materials, dimensions on the 3D model, camera views, reviews, related items, SEO data | ✅ |
| Basket, checkout, order confirmation, basket clears after order | ✅ |
| Room planner: presets, save and share link, add whole room to basket | ✅ |
| Reviews, newsletter, rejects bad checkout data | ✅ |
| Mobile: no sideways scrolling on 6 pages, sticky "Add to basket" bar | ✅ |
| Console errors | **None** |
| **Total** | **42 of 42 checks pass** |

### Speed: our home page and the client's current site

Measured in the same Chrome browser on the same laptop and connection, with an empty cache.

| | Our site (through the public ngrok link) | muscatfurniture.com (desktop) | muscatfurniture.com (mobile) |
|---|---|---|---|
| Page weight | **0.6 MB** | 7.7 MB | 8.0 MB |
| Number of requests | **35** | 333 | 347 |
| First content on screen | 1.8 s | 1.4 s | 1.6 s |
| Fully loaded | **3.5 s** | 48.8 s | 28.5 s |

Our site was served from a laptop through a tunnel, which is its worst case. On Vercel's servers it will be
faster. muscatfurniture.com's very long full-load time comes from 300+ extra files: images, apps and scripts.

## 3. What the Muscat competitors offer

| Feature | muscatfurniture.com (client, now) | IKEA Oman | Danube Home Oman | Pan Home Oman | **Our site** |
|---|---|---|---|---|---|
| Arabic language | Product names in Arabic + English, Arabic banners | Not seen | Yes | Yes (Arabic site) | ❌ **Not yet** |
| Currency | OMR, 3 decimals, "Tax included" | Not seen | OMR | OMR | ❌ GBP (UK) |
| WhatsApp ordering / chat | ✅ "Order on WhatsApp", chat button | ❌ (toll-free phone) | ✅ | Not seen | ❌ **Not yet** |
| Cash on delivery | Not seen | Not seen | ✅ selected areas | Not seen | ❌ |
| Instalments | Not seen | "Finance options" page | ✅ 4-month EMI | Not seen | ❌ |
| Free delivery | Over OMR 75 | Free pickup across Oman | Free delivery + installation (T&C) | Over OMR 19 (furniture) | Free over a threshold (UK setup) |
| Returns | Policy page | 90 days (120 for members) | 14 days | Not seen | 14 days + 100-night trial |
| Warranty | Not seen | — | 6 months – 2 years | 2 years | Lifetime frame |
| Showrooms / store locator | 6 cities | 1 Muscat store | ✅ | ✅ | ❌ one studio address |
| Product photos | ✅ | ✅ | ✅ | ✅ | ❌ live 3D models instead |
| Colour / fabric choice on product | ❌ none | — | ✅ colour swatches | Not seen | ✅ **fabric, wood and metal, shown live in 3D** |
| Customer reviews on product | ❌ not seen | — | ✅ | Not seen | ✅ **with "write a review"** |
| Delivery date estimate | ❌ | — | ❌ | ❌ | ✅ |
| 3D / AR / 360° viewer | ❌ | ❌ on product pages | ❌ | ❌ | ✅ **every product** |
| Room planner | ❌ | "Planning tools" section | ❌ | ❌ | ✅ **drag-and-drop 3D, presets, share link, add room to basket** |
| See furniture at different times of day | ❌ | ❌ | ❌ | ❌ | ✅ **only us** |
| Exploded view (how it's built) | ❌ | ❌ | ❌ | ❌ | ✅ **only us** |
| Dimensions drawn on the product | ❌ (text, some wrong) | — | Text table | — | ✅ **drawn on the 3D model** |
| Wishlist / compare / quick view | ✅ | ✅ shopping list | ✅ wishlist | ✅ wishlist | ❌ |
| Customer accounts | ✅ | ✅ (+ loyalty app) | ✅ | ✅ | ❌ |
| Admin panel to manage products | ✅ Shopify admin | ✅ | ✅ | ✅ | ❌ **must build** |

"Not seen" means it did not appear on the pages read; it may still exist elsewhere on that site.

### Problems seen on the client's current site (fixed by design in the new site)

- Product data errors. The Dublin sofa has mislabelled dimensions ("Three seater 85L*85W*220H"), its
  description says "leather" while the spec says "Fabric", and it shows the Oslo SKU. One product lists
  "Regular price 0.000 OMR". Some page addresses don't match their product names.
- Nearly every item shows exactly "50% OFF". The struck-through "regular" prices are hard to believe.
- No reviews, delivery estimates or colour choices on product pages.
- Very heavy pages (333 files), which hurts mobile users and Google ranking.
- The footer still says © 2024.

## 4. Full feature list of our site: 45 features

**3D and visual — 19 features (none of the Oman competitors checked have these on product pages)**
1. Self-assembling furniture: a blueprint flies together into the real piece as you scroll
2. "Materialise" glow effect as each part appears
3. Material lab: tap a fabric and the colour sweeps across the sofa
4. Day-to-night lighting: the sun moves, shadows sweep and the lamp turns on at night
5. 24 products, all live 3D models (no photography needed for the demo)
6. Hover a product card to pull the piece apart and see the joinery
7. Drag to rotate any product
8. Exploded-view slider on product pages
9. Time-of-day slider on product pages
10. Camera buttons: 3/4, front, side, top
11. Real dimensions drawn on the 3D model
12. "Shop by room" tiles, each a live 3D scene
13. 3D room planner: drag, rotate, duplicate and remove pieces
14. Ready-made room layouts: living, bedroom, dining, office
15. Table lamps sit on tables automatically
16. Planner time-of-day slider
17. Save a room and share it as a link
18. Add the whole planned room to the basket in one click
19. Automatic quality drop on slow phones, with a message if 3D is unavailable

**Shopping — 15 features**
20. Shop page with room, type and price filters plus sorting (shareable links)
21. Mega menu organised by room
22. Instant product search (Ctrl/⌘ + K)
23. Material configurator (fabric, wood, metal)
24. Quantity selector and add to basket
25. Slide-in basket with a free-delivery progress bar
26. Basket saved on the server (survives refresh)
27. Checkout with address, delivery choice and tax breakdown
28. Order confirmation page with order number
29. Delivery date estimate
30. Trade / bulk quote request form
31. Star ratings and "write a review"
32. "Pairs well with" related products
33. Breadcrumbs
34. Details, dimensions, care and delivery sections on every product

**Content and trust — 5 features**
35. Help page (delivery, returns, guarantee, care)
36. Legal page (privacy, terms, cookies)
37. Newsletter sign-up
38. Company details in the footer
39. Announcement bar

**Technical — 6 features**
40. Fully mobile: phone menu and sticky "Add to basket" bar
41. SEO: sitemap, robots file, product data for Google, page titles
42. Friendly 404 and error pages
43. Accessibility: keyboard use, skip link, reduced-motion support
44. Security: all input checked, prices set by the server, each visitor's basket private
45. Light and fast: 0.6 MB home page

## 5. Why our site wins: the pitch

1. **"Build it, touch it, live with it — before you buy."** No other Oman furniture site shows a sofa being
   built, changes its fabric live, or shows it at 10 pm under lamplight.
2. **Fewer returns and fewer "is it big enough?" calls.** Dimensions drawn on the model, a room planner and
   time-of-day lighting help buyers choose correctly.
3. **Bigger orders.** "Add whole room to basket" turns one sofa sale into a full living room.
4. **Trust.** Real reviews, honest prices, clear delivery dates and no data errors.
5. **Speed and Google.** About 12× lighter pages than the current site.

## 6. What must be done before launch in Muscat

| # | Change | Why |
|---|---|---|
| 1 | **Arabic + English with right-to-left layout** | Competitors and the client's own site already use Arabic; Oman's consumer law expects Arabic pricing |
| 2 | **OMR with 3 decimals, 5% VAT included** | Oman VAT is 5% since 16 April 2021, and prices must include VAT |
| 3 | **"Order on WhatsApp" + chat button** | The client's current site and Danube use it; it is how many Omani customers buy |
| 4 | **Cash on delivery + Thawani/cards + instalments (Tabby/Tamara)** | Danube offers COD and EMI |
| 5 | **Oman delivery by governorate/wilaya**, replacing UK postcodes | Muscat, Sohar, Nizwa, Salalah… |
| 6 | **Store locator for the 6 showrooms** | The client already has 6 cities |
| 7 | **The client's real catalogue**: sofa sets, bedroom sets, mattresses, lighting, switches, sanitary | Our 24 pieces are demo designs |
| 8 | **Real product photos + 3D models of best-sellers** (GLB files from the supplier or a 3D artist) | 3D on hero products, photos for the long tail such as switches |
| 9 | **Admin panel** to add products, prices, sales and orders, or keep Shopify as the back-end ("headless") | The client manages everything in Shopify today |
| 10 | **Sale/discount system, wishlist, customer accounts** | Competitors all have these; the client runs frequent sales |
| 11 | **Oman e-commerce compliance**: commercial registration, Maroof verification, licence number on the site, Arabic returns policy | Ministerial Decision 499/2023 and Consumer Protection Law |
| 12 | **Permanent hosting** (Vercel + database) and the client's domain | The ngrok link is temporary |

## Sources

- Client site: https://muscatfurniture.com (product https://muscatfurniture.com/products/dublin, collection https://muscatfurniture.com/collections/sofa-set), read 30 Oct 2026
- IKEA Oman: https://www.ikea.com/om/en/customer-service/returns-claims/ and https://www.ikea.com/om/en/customer-service/services/
- Danube Home Oman: https://www.danubehome.com/om/en and https://danubehome.com/om/en/furniture/sofas/sofa-beds
- Pan Home Oman: https://www.panhomestores.com/oman_en/
- Home Centre Oman / OC Home: blocked automated access (HTTP 403/405), not assessed
- Oman VAT 5% and VAT-inclusive pricing: https://imagesretailme.com/oman-vat-what-retailers-need-to-know-before-its-implementation , https://www.khaleejtimes.com/world/gulf/oman-rolls-out-5-vat-on-most-goods-and-services?amp=1
- Arabic price display (lawyer commentary): https://timesofoman.com/article/173264-how-omans-consumer-protection-law-regulates-price-display
- Oman e-commerce rules: https://www.lexis.ae/2023/09/13/oman-ecommerce-decision-issued/ , https://www.omanobserver.om/article/1142617/business/oman-unveils-new-e-commerce-regulatory-framework , https://www.zawya.com/en/economy/gcc/oman-cpa-warns-online-vendors-to-adhere-to-law-cm2ma7cc
