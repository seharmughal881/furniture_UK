# Atelier — UK market requirements

What a UK online furniture shop must do, what this site already does, and what the client must supply before
launch. Researched October 2026 from GOV.UK, legislation.gov.uk, the ICO, the ASA and Trading Standards guidance.

> This is a developer's research summary, not legal advice. Have a UK solicitor review the terms, privacy notice
> and returns policy before launch.

## 1. Requirements and how the site meets them

| # | UK rule | What it requires | Status on the site |
|---|---|---|---|
| 1 | **Price Marking Order 2004** | Prices shown to consumers must be in sterling, include VAT, and sit next to the product. | Done. All prices in £ with "inc. VAT" on product pages; checkout and order confirmation show "Includes VAT at 20%". |
| 2 | **DMCC Act 2024 — drip pricing** (in force 6 April 2025) | Mandatory fees must not be "dripped" in during checkout. The CMA's final price-transparency guidance (Nov 2025) covers mandatory fees; how strictly it treats delivery is unclear in the commentary. | Delivery cost is shown on every product page, in the basket and before ordering, with one flat UK price. **Solicitor to confirm** whether delivery must also be built into the headline price. |
| 3 | **ASA / CAP delivery claims** | "UK delivery" covers the whole UK, including the Highlands, islands and Northern Ireland. Do not claim "free UK delivery" if surcharges apply. | Done. One price for every UK postcode, stated in the banner, product page, checkout and help page. |
| 4 | **Consumer Contracts Regulations 2013 — right to cancel** | 14 days from delivery to cancel online orders. Reg. 28(1)(b) lets traders exclude goods "made to the consumer's specifications or … clearly personalised". | Done. 14-day right explained at checkout, on the order page and on the help page. The site does not use the made-to-order exemption for catalogue items; the 100-night trial is offered on top. |
| 5 | **Consumer Contracts Regulations 2013, reg. 14(3)–(5) — order button** | The button must say "order with obligation to pay" or an equally clear phrase. If not, **the customer is not bound by the contract**. | Done. Button reads "Order with obligation to pay · £…". Change to "Pay now" once real payment is added. |
| 6 | **Consumer Rights Act 2015** | Goods must be of satisfactory quality, fit for purpose and as described. 30-day short-term right to reject; then repair/replace; then refund or price reduction. Deliver within 30 days unless agreed. | Done. Explained in the product page returns section, help page and terms. |
| 7 | **Companies Act 2006 + Electronic Commerce Regulations 2002** | The website must show the company name, registration number, place of registration, registered office and an email address; VAT number where VAT-registered. | Footer and legal page show all fields. **Values are placeholders** in `src/lib/company.ts`. |
| 8 | **UK GDPR, Data Protection Act 2018** | A privacy notice: controller, purposes, lawful bases, retention, rights, ICO complaint route. | Draft privacy notice on `/legal#privacy`. Needs solicitor review. |
| 9 | **PECR (cookies)** | Consent is needed for non-essential cookies. A basket cookie is "strictly necessary" and exempt (ICO's own example). | Done. The site sets only the basket cookie, so no consent banner is needed. **If analytics or ads are added, a consent banner becomes mandatory.** |
| 10 | **Furniture and Furnishings (Fire) (Safety) Regulations 1988**, amended 30 October 2025 | Upholstered furniture must pass the fire tests and carry a permanent label. The point-of-sale display label was removed by the 2025 amendment. | Fire-safety note on upholstered product pages and the help page. The maker must fit permanent labels and keep test records. |
| 11 | **WEEE Regulations 2013** | Sellers of electricals must take back an old item of the same type free (at least 28 days), and online sellers must publish this on their website. | Done for lamps. Note on lamp product pages and `/help#weee`. The client must choose: own take-back service or join the Distributor Takeback Scheme. |
| 12 | **UK sizes and wording** | UK mattress sizes: single 90×190, double 135×190, king 150×200, super king 180×200 cm. UK spelling and terms. | Done. Bed changed to a UK king (150×200 mattress). "Basket", "postcode", "county", en-GB dates and spelling. |
| 13 | **UK addresses** | Postcode format, optional address line 2 and county, UK phone numbers. | Done. Server-side postcode and phone validation; postcodes normalised (e.g. "sw1a1aa" → "SW1A 1AA"). |

## 2. What the client must supply before launch

1. **Company details** for `src/lib/company.ts`: legal name, company number, registered office, VAT number, email, phone.
2. **A solicitor's review** of `/legal` (privacy notice and terms) and `/help` (returns and cancellation).
3. **A payment provider** (for example Stripe, with Klarna or Clearpay if pay-later is wanted). Payment authentication (SCA) is required for UK card payments. Then remove the "demo" banners.
4. **Fire-safety evidence** for every upholstered piece, and confirmation that permanent labels are fitted.
5. **A WEEE route**: an in-house take-back service or membership of the Distributor Takeback Scheme.
6. **Real reviews**: delete the sample reviews with `DELETE FROM reviews WHERE is_demo;`.
7. **A decision on delivery pricing** under the DMCC Act (item 2 above).

## 3. Sources

- GOV.UK — [Tax on shopping and services (where you see VAT)](https://www.gov.uk/vat/where-you-see-vat)
- Trading Standards — [Price Marking Order 2012 guidance (Southwark)](https://services.southwark.gov.uk/assets/attach/10810/Price-Marking-Order-2012.pdf), [Providing price information (Pembrokeshire)](https://cms.pembrokeshire.gov.uk/trading-standards-information/providing-price-information), [Pricing information (NI Business Info)](https://nibusinessinfo.co.uk/content/avoid-misleading-pricing-information)
- legislation.gov.uk — [Consumer Contracts Regulations 2013, reg. 28](https://www.legislation.gov.uk/uksi/2013/3134/regulation/28) and [reg. 14](https://www.legislation.gov.uk/uksi/2013/3134/regulation/14)
- legislation.gov.uk — [Consumer Rights Act 2015, s.22 explanatory notes](https://legislation.gov.uk/ukpga/2015/15/section/22/notes?view=plain)
- legislation.gov.uk — [Furniture and Furnishings (Fire) (Safety) Regulations 1988, Schedule 7](https://legislation.gov.uk/uksi/1988/1324/schedule/7/made?view=plain)
- GOV.UK — [Furniture and Furnishings (Fire) (Safety) (Amendment) Regulations 2025: statutory guidance](https://www.gov.uk/government/publications/furniture-and-furnishings-fire-safety-regulations/furniture-and-furnishings-fire-safety-amendment-regulations-2025-uk)
- Business Companion — [Furniture fire safety guidance](https://www.businesscompanion.info/node/466/printable/print)
- GOV.UK — [Electrical waste: retailer and distributor responsibilities](https://www.gov.uk/electricalwaste-producer-supplier-responsibilities/retailers-and-distributors)
- ASA guidance via Highland Council — [Report unfair delivery charges](https://www.highland.gov.uk/info/20000/trading_standards/196/buying_goods_online)
- ICO guidance via Pinsent Masons — [Cookie laws guide](https://www.pinsentmasons.com/out-law/guides/cookie-laws)
- CMS — [Electronic communication: company information requirements](https://cms.law/en/gbr/legal-updates/electronic-communication-company-information-requirements)
- CMS — [Price transparency guidance and first DMCC Act investigations](https://cms.law/en/gbr/legal-updates/price-transparency-guidance-lands-as-cma-launches-first-consumer-law-investigations-using-its-new-dmcc-act-powers); Taylor Wessing — [DMCCA drip pricing](https://www.taylorwessing.com/de/insights-and-events/insights/2025/04/dmcca-drip-pricing)
- UK mattress sizes — [DFS bed and mattress size guide](https://m.dfs.co.uk/content/bed-and-mattress-size-guide), [Simply Mattresses UK size guide](https://simplymattresses.co.uk/blogs/insight/bed-and-mattress-sizes-guide-uk)
