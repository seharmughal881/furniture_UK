// Imports the Muscat Furniture catalogue from its Shopify store into our database.
//
//   npm run import:muscat            # import from the saved snapshot in data/muscat-import
//   npm run import:muscat -- --fetch # download a fresh snapshot from muscatfurniture.com first
//
// Shopify stays the place where the client manages products; re-run this to sync.
// Only the public storefront feeds (/products.json, /collections/<handle>/products.json) are used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import type { FurnitureKind } from "../src/three/furniture";

const STORE = "https://muscatfurniture.com";
const DIR = join(__dirname, "..", "data", "muscat-import");
const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

type ShopifyVariant = { title: string; price: string; compare_at_price: string | null; available: boolean; sku: string };
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: { src: string }[];
};

// Collections we read to place products; order matters (first match wins for category).
const COLLECTIONS = [
  "sofa-set", "imported-sofa-sets", "sofa-sets-made-in-oman", "corner-sofa", "1-seater-sofa", "2-seater-sofa",
  "3-seater-sofa", "recliners", "chairs", "coffee-table", "tv-stand", "metal-wall-arts", "bedroom-sets-2",
  "beds-bed-frames", "fabric-beds", "wardrobe", "dresser", "nightstands", "cupboards-nightstands", "mattress",
  "bedsheets", "dining-chairs-and-table", "chandeliers", "pendants", "wall-lights", "ceiling-lights",
  "led-ceiling-lights", "outdoor-lights", "flood-lights-1", "spot-lights-recessed", "solar-lights", "switches",
  "sockets", "outlet", "dp-switches-20amps-40-amps", "sanitary", "most-selling", "new-arrivals-1",
];

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (catalogue sync)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchSnapshot() {
  mkdirSync(join(DIR, "col"), { recursive: true });
  const all = new Map<number, ShopifyProduct>();
  for (let page = 1; page < 20; page++) {
    const { products } = await getJson(`${STORE}/products.json?limit=250&page=${page}`);
    if (!products.length) break;
    for (const p of products) all.set(p.id, p);
  }
  writeFileSync(join(DIR, "catalogue.json"), JSON.stringify([...all.values()]));
  for (const c of COLLECTIONS) {
    const ids: number[] = [];
    for (let page = 1; page < 10; page++) {
      const { products } = await getJson(`${STORE}/collections/${c}/products.json?limit=250&page=${page}`);
      ids.push(...products.map((p: ShopifyProduct) => p.id));
      if (products.length < 250) break;
    }
    writeFileSync(join(DIR, "col", `${c}.ids`), ids.join("\n") + "\n");
  }
  console.log(`Fetched ${all.size} products and ${COLLECTIONS.length} collections.`);
}

// ---------------------------------------------------------------------------------- mapping

const toBaisa = (omr: string | null) => (omr ? Math.round(parseFloat(omr) * 1000) : 0);

function splitTitle(title: string) {
  // "OSLO SOFA SET | أوسلو- طقم كنب" -> English + Arabic
  const parts = title.split("|").map((s) => s.trim());
  const ar = parts.find((s) => /[؀-ۿ]/.test(s)) ?? "";
  const en = parts.find((s) => !/[؀-ۿ]/.test(s)) ?? title;
  return { en: tidy(en), ar };
}

/** "DUBLIN SOFA SET" -> "Dublin Sofa Set", leaving codes like "9856-4" and "LED" alone. */
function tidy(s: string) {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters && letters !== letters.toUpperCase()) return s.replace(/\s+/g, " ").trim();
  const keep = new Set(["LED", "TV", "DP", "USB", "UK", "II", "III", "IP65", "IP44", "RGB", "CCT", "AMP"]);
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (keep.has(w.replace(/[^A-Z0-9]/g, "")) || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function htmlToText(html: string | null) {
  return (html ?? "")
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const COLOURS: [RegExp, string][] = [
  [/navy/i, "#2c3447"], [/\bblue\b/i, "#3f5a7a"], [/ivory|cream|off.?white/i, "#e8e0d2"], [/beige|camel|sand/i, "#cdb79a"],
  [/light grey|light gray/i, "#b7b4ae"], [/dark grey|dark gray|charcoal|graphite/i, "#4f4f52"], [/grey|gray|silver/i, "#8f8d89"],
  [/brown|walnut|coffee|chocolate/i, "#6b4a33"], [/black/i, "#2b2b2b"], [/green|olive|sage/i, "#7f8f6a"],
  [/pink|rose|blush/i, "#d8a7a4"], [/yellow|mustard|ochre/i, "#c9963d"], [/orange|terracotta/i, "#b65a3a"],
  [/red|maroon|burgundy/i, "#8a2f2f"], [/white/i, "#eeebe5"], [/gold/i, "#b08d57"],
];
const colourOf = (text: string) => COLOURS.find(([re]) => re.test(text))?.[1] ?? "";

type Placement = { category: string; rooms: string[]; kind: FurnitureKind | null };

function place(p: ShopifyProduct, inCol: (c: string) => boolean): Placement {
  const t = `${p.title} ${p.tags.join(" ")}`.toLowerCase();
  const type = p.product_type.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  if (type === "switch" || ["switches", "sockets", "outlet", "dp-switches-20amps-40-amps"].some(inCol))
    return { category: "switches", rooms: [], kind: null };
  if (type === "sanitary" || inCol("sanitary")) return { category: "sanitary", rooms: ["bathroom"], kind: null };
  if (type === "light" || /chandelier|pendant|ceiling fan|wall light|spot ?light|flood ?light|bulb/.test(t) ||
      ["chandeliers", "pendants", "wall-lights", "ceiling-lights", "led-ceiling-lights", "outdoor-lights", "flood-lights-1",
       "spot-lights-recessed", "solar-lights"].some(inCol)) {
    const outdoor = ["outdoor-lights", "flood-lights-1", "solar-lights"].some(inCol) || /outdoor|garden|bollard|flood/.test(t);
    return { category: "lighting", rooms: outdoor ? ["outdoor"] : [], kind: null };
  }
  if (inCol("mattress") || has(/mattress/)) return { category: "mattresses", rooms: ["bedroom"], kind: null };
  if (inCol("bedsheets") || has(/bed ?sheet|comforter/)) return { category: "bedding", rooms: ["bedroom"], kind: null };
  if (inCol("metal-wall-arts") || has(/metal art|wall art/)) return { category: "decor", rooms: ["living"], kind: null };
  if (has(/mirror/)) return { category: "decor", rooms: ["bedroom"], kind: "mirror" };

  // dining
  if (inCol("dining-chairs-and-table") || has(/dining/)) {
    const chairOnly = has(/dining chair/) && !has(/table/);
    return { category: "dining", rooms: ["dining"], kind: chairOnly ? "diningChair" : "diningTable" };
  }
  // bedroom
  if (inCol("bedroom-sets-2") || has(/bedroom set/)) return { category: "bedroom-sets", rooms: ["bedroom"], kind: "bed" };
  if (inCol("wardrobe") || has(/wardrobe|cupboard/)) return { category: "storage", rooms: ["bedroom"], kind: "wardrobe" };
  if (inCol("nightstands") || has(/nightstand|night stand|bedside/)) return { category: "storage", rooms: ["bedroom"], kind: "nightstand" };
  if (inCol("dresser") || has(/dresser|chest of drawers/)) return { category: "storage", rooms: ["bedroom"], kind: "dresser" };
  if (["beds-bed-frames", "fabric-beds"].some(inCol) || has(/\bbed\b|divan|bed frame/)) return { category: "beds", rooms: ["bedroom"], kind: "bed" };
  // living
  if (inCol("tv-stand") || has(/tv stand|tv unit/)) return { category: "tables", rooms: ["living"], kind: "mediaConsole" };
  if (inCol("coffee-table") || has(/coffee table/)) return { category: "tables", rooms: ["living"], kind: "coffeeTable" };
  if (has(/side ?table|sidestand|side stand|end table/)) return { category: "tables", rooms: ["living"], kind: "sideTable" };
  if (has(/study|computer table|desk/)) return { category: "tables", rooms: ["office"], kind: "desk" };
  if (inCol("corner-sofa") || has(/corner|l.?shape|sectional/)) return { category: "sofas", rooms: ["living"], kind: "sectional" };
  if (["1-seater-sofa", "recliners"].some(inCol) || has(/single seater|1 seater|recliner|armchair/))
    return { category: "sofas", rooms: ["living"], kind: "armchair" };
  if (["sofa-set", "imported-sofa-sets", "sofa-sets-made-in-oman", "2-seater-sofa", "3-seater-sofa"].some(inCol) || has(/sofa|seater/))
    return { category: "sofas", rooms: ["living"], kind: "sofa" };
  if (inCol("chairs") || has(/chair/)) return { category: "sofas", rooms: ["living"], kind: "armchair" };
  return { category: "furniture", rooms: ["living"], kind: null };
}

/**
 * Clean, Latin-only URL slug. Many Shopify handles carry the Arabic name too
 * ("preston-dresser-بريستون-تسريحة"); those break as route parameters and are awkward to share.
 */
const usedSlugs = new Map<string, number>(); // slug -> product id
function uniqueSlug(handle: string, name: string, id: number) {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  const base = clean(handle) || clean(name) || `product-${id}`;
  let slug = base;
  for (let n = 2; usedSlugs.has(slug) && usedSlugs.get(slug) !== id; n++) slug = `${base}-${n}`;
  usedSlugs.set(slug, id);
  return slug;
}

// ---------------------------------------------------------------------------------- import

async function main() {
  if (process.argv.includes("--fetch")) await fetchSnapshot();
  const products: ShopifyProduct[] = JSON.parse(readFileSync(join(DIR, "catalogue.json"), "utf8"));
  const members = new Map<string, Set<number>>();
  for (const c of COLLECTIONS) {
    const f = join(DIR, "col", `${c}.ids`);
    members.set(c, new Set(existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map(Number) : []));
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = await pool.connect();
  const counts: Record<string, number> = {};
  let with3d = 0;
  try {
    await db.query("BEGIN");
    // Retire the invented demo catalogue and its sample reviews; orders that reference them stay intact.
    await db.query("UPDATE products SET active = false WHERE source = 'demo'");
    await db.query("DELETE FROM reviews WHERE is_demo");
    // free every imported slug first so renamed slugs can't collide mid-import
    await db.query("UPDATE products SET slug = 'tmp-' || id WHERE source = 'muscat'");

    const seen: number[] = [];
    for (const [i, p] of products.entries()) {
      const inCol = (c: string) => members.get(c)?.has(p.id) ?? false;
      const { en, ar } = splitTitle(p.title);
      const where = place(p, inCol);
      counts[where.category] = (counts[where.category] ?? 0) + 1;
      if (where.kind) with3d++;

      const variants = p.variants.map((v) => ({
        title: v.title === "Default Title" ? "" : v.title,
        price_cents: toBaisa(v.price),
        compare_at_cents: v.compare_at_price && toBaisa(v.compare_at_price) > toBaisa(v.price) ? toBaisa(v.compare_at_price) : null,
        available: v.available,
      }));
      const first = variants[0];
      const description = htmlToText(p.body_html);
      const details = description
        .split("\n")
        .filter((l) => l.startsWith("• ") || /^[A-Za-z ]{2,30}:\s/.test(l))
        .map((l) => l.replace(/^• /, ""))
        .slice(0, 10);
      const featured = inCol("most-selling") || inCol("new-arrivals-1");
      const slug = uniqueSlug(p.handle, en, p.id);

      await db.query(
        `INSERT INTO products (slug, name, name_ar, kind, tagline, description, price_cents, compare_at_cents, lead_time_weeks,
                               category, rooms, details, care, images, vendor, sku, in_stock, featured, colour, variants,
                               source, external_id, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,'',$12,$13,$14,$15,$16,$17,$18::jsonb,'muscat',$19,true,$20)
         ON CONFLICT (external_id) DO UPDATE SET
           slug = EXCLUDED.slug, name = EXCLUDED.name, name_ar = EXCLUDED.name_ar, kind = EXCLUDED.kind,
           tagline = EXCLUDED.tagline, description = EXCLUDED.description, price_cents = EXCLUDED.price_cents,
           compare_at_cents = EXCLUDED.compare_at_cents, category = EXCLUDED.category, rooms = EXCLUDED.rooms,
           details = EXCLUDED.details, images = EXCLUDED.images, vendor = EXCLUDED.vendor, sku = EXCLUDED.sku,
           in_stock = EXCLUDED.in_stock, featured = EXCLUDED.featured, colour = EXCLUDED.colour,
           variants = EXCLUDED.variants, active = true, sort_order = EXCLUDED.sort_order`,
        [
          slug, en, ar, where.kind, description.split("\n")[0]?.slice(0, 160) ?? "", description,
          first?.price_cents ?? 0, first?.compare_at_cents ?? null, where.category, where.rooms, details,
          p.images.map((im) => im.src), p.vendor, p.variants[0]?.sku ?? "", p.variants.some((v) => v.available),
          featured, colourOf(`${p.title} ${p.tags.join(" ")}`), JSON.stringify(variants), p.id, featured ? i - 10000 : i,
        ],
      );
      seen.push(p.id);
    }
    // products removed from the Shopify store disappear here too
    await db.query("UPDATE products SET active = false WHERE source = 'muscat' AND NOT (external_id = ANY($1))", [seen]);

    for (const [i, s] of STORES.entries()) {
      await db.query(
        `INSERT INTO stores (slug, name, city, address, phone, whatsapp, email, hours, kind, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
           phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, email = EXCLUDED.email, hours = EXCLUDED.hours,
           kind = EXCLUDED.kind, sort_order = EXCLUDED.sort_order`,
        [s.slug, s.name, s.city, s.address, s.phone, s.whatsapp, s.email, s.hours, s.kind, i],
      );
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
  console.log(`Imported ${products.length} products (${with3d} with a 3D preview model).`);
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · "));
}

// Showrooms as published on https://muscatfurniture.com/pages/contact (October 2026).
const HOURS_A = "Sat–Thu 9 am – 1 pm and 4 pm – 10 pm · Fri 4:30 pm – 9 pm";
const HOURS_B = "Sat–Thu 9 am – 10 pm · Fri 4:30 pm – 9 pm";
const STORES = [
  { slug: "al-hail-north", name: "Al Hail North showroom", city: "Muscat", address: "Al-Hail North, Muscat (P.O. Box 1182, PC 121)", phone: "+968 2443 4625", whatsapp: "+968 9139 0025", email: "sr1@mfi.om", hours: HOURS_B, kind: "showroom" },
  { slug: "sohar", name: "Sohar showroom", city: "Sohar", address: "Service Road, opposite Muscat Lighting, Sohar", phone: "+968 2684 6630", whatsapp: "+968 9120 2531", email: "sr2@mfi.om", hours: HOURS_B, kind: "showroom" },
  { slug: "barka", name: "Barka showroom", city: "Barka", address: "Opposite Oman Oil, before Al Salaam Mosque, Barka", phone: "+968 2698 3059", whatsapp: "+968 9399 3953", email: "sr3@mfi.om", hours: HOURS_A, kind: "showroom" },
  { slug: "al-bidaya", name: "Al-Bidaya showroom", city: "Al-Suwaiq", address: "Beside N.B.O., Wilayat Al-Suwaiq, Al-Bidaya", phone: "+968 2670 9484", whatsapp: "+968 9125 6280", email: "sr4@mfi.om", hours: HOURS_A, kind: "showroom" },
  { slug: "nizwa", name: "Nizwa showroom", city: "Nizwa", address: "Beside Bank Muscat, opposite Grand Mall, Nizwa", phone: "+968 2521 6060", whatsapp: "+968 9178 5347", email: "sr5@mfi.om", hours: HOURS_B, kind: "showroom" },
  { slug: "salalah", name: "Salalah showroom", city: "Salalah", address: "Al Matar Street, near Nabi Umran Tomb, Salalah 211", phone: "+968 9122 0436", whatsapp: "+968 9399 3950", email: "onlinepur@mfi.om", hours: HOURS_A, kind: "showroom" },
  { slug: "head-office", name: "Head office", city: "Muscat", address: "Azaiba North, House 800, Way 7014, Muscat (P.O. Box 1182, PC 121)", phone: "+968 9122 0436", whatsapp: "+968 9399 3950", email: "onlinepur@mfi.om", hours: "", kind: "office" },
];

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
