// Seed data for the catalogue. The database is the source of truth at runtime;
// this file only feeds `npm run db:setup`.
import type { FurnitureKind } from "@/three/furniture";

export const SEED_PRODUCTS: {
  slug: string;
  name: string;
  kind: FurnitureKind;
  tagline: string;
  description: string;
  price_cents: number;
  lead_time_weeks: number;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
}[] = [
  {
    slug: "loma-sofa",
    name: "Loma Sofa",
    kind: "sofa",
    tagline: "A deep, low three-seater built to be lived on.",
    description:
      "Kiln-dried oak frame, eight-way hand-tied springs and feather-wrapped cushions. Every Loma is assembled by one maker from first joint to final stitch.",
    price_cents: 299500,
    lead_time_weeks: 8,
    width_cm: 210,
    depth_cm: 90,
    height_cm: 82,
  },
  {
    slug: "ondo-lounge-chair",
    name: "Ondo Lounge Chair",
    kind: "armchair",
    tagline: "The reading chair, reconsidered.",
    description:
      "A slightly reclined back and wide arms make Ondo the chair you finish the book in. Removable covers, solid timber base.",
    price_cents: 129500,
    lead_time_weeks: 6,
    width_cm: 86,
    depth_cm: 84,
    height_cm: 80,
  },
  {
    slug: "halo-coffee-table",
    name: "Halo Coffee Table",
    kind: "coffeeTable",
    tagline: "Two discs of solid timber, one quiet idea.",
    description:
      "A round top and a floating lower shelf on three slender steel legs. Oiled by hand and finished with a hard wax.",
    price_cents: 69500,
    lead_time_weeks: 5,
    width_cm: 90,
    depth_cm: 90,
    height_cm: 38,
  },
  {
    slug: "vela-floor-lamp",
    name: "Vela Floor Lamp",
    kind: "floorLamp",
    tagline: "Evening light, woven.",
    description:
      "A linen shade on a brushed steel stem. Dimmable warm LED tuned to 2700K so the room glows instead of glares.",
    price_cents: 37900,
    lead_time_weeks: 3,
    width_cm: 48,
    depth_cm: 48,
    height_cm: 160,
  },
  {
    slug: "arca-bookshelf",
    name: "Arca Bookshelf",
    kind: "bookshelf",
    tagline: "Five shelves, zero screws.",
    description:
      "Joined entirely with wedged through-tenons. Arca knocks down flat for moving day and goes back together in minutes.",
    price_cents: 99500,
    lead_time_weeks: 7,
    width_cm: 90,
    depth_cm: 32,
    height_cm: 180,
  },
  {
    slug: "pip-side-table",
    name: "Pip Side Table",
    kind: "sideTable",
    tagline: "A small table for a cup and a good book.",
    description:
      "A turned timber top on a steel pedestal. Light enough to carry from sofa to bedside.",
    price_cents: 26900,
    lead_time_weeks: 3,
    width_cm: 48,
    depth_cm: 48,
    height_cm: 55,
  },
  {
    slug: "bruma-corner-sofa",
    name: "Bruma Corner Sofa",
    kind: "sectional",
    tagline: "A corner sofa with a chaise long enough to stretch out on.",
    description:
      "The Loma's deep seat, extended into an L. The chaise sits on the right as standard; ask the studio for a left-hand build.",
    price_cents: 449500, lead_time_weeks: 10, width_cm: 270, depth_cm: 162, height_cm: 82,
  },
  {
    slug: "linea-media-console",
    name: "Linea Media Console",
    kind: "mediaConsole",
    tagline: "Low, long and quiet — hides every cable.",
    description: "Three push-to-open doors, adjustable shelves and a cable channel in the back panel. Holds screens up to 85 inches.",
    price_cents: 129500, lead_time_weeks: 7, width_cm: 180, depth_cm: 42, height_cm: 50,
  },
  {
    slug: "nido-pouf",
    name: "Nido Pouf",
    kind: "pouf",
    tagline: "Footrest, extra seat, side table — whatever the evening needs.",
    description: "A firm, round pouf on a turned timber base. Upholstered in any Atelier fabric.",
    price_cents: 29900, lead_time_weeks: 4, width_cm: 56, depth_cm: 56, height_cm: 42,
  },
  {
    slug: "terra-wool-rug",
    name: "Terra Wool Rug",
    kind: "rug",
    tagline: "Hand-tufted wool with a quiet border.",
    description: "Dense New Zealand wool, hand-tufted and finished with a contrast border. 200 × 300 cm.",
    price_cents: 94900, lead_time_weeks: 6, width_cm: 200, depth_cm: 300, height_cm: 1,
  },
  {
    slug: "vale-console-table",
    name: "Vale Console Table",
    kind: "consoleTable",
    tagline: "For keys, post and a good lamp by the door.",
    description: "A slim timber top and lower shelf on a fine steel frame. Only 35 cm deep, so it fits narrow hallways.",
    price_cents: 54900, lead_time_weeks: 5, width_cm: 120, depth_cm: 35, height_cm: 78,
  },
  {
    slug: "sora-bed",
    name: "Sora King Bed",
    kind: "bed",
    tagline: "An upholstered headboard on a solid timber frame.",
    description:
      "UK king size — fits a standard 150 × 200 cm king mattress. Solid slats, centre support rail and a padded headboard for reading in bed. Mattress sold separately; double and super king built to order.",
    price_cents: 189500, lead_time_weeks: 8, width_cm: 164, depth_cm: 213, height_cm: 108,
  },
  {
    slug: "sora-bedside-table",
    name: "Sora Bedside Table",
    kind: "nightstand",
    tagline: "Two soft-close drawers at just the right height.",
    description: "Sized to sit level with the Sora mattress. Dovetailed drawers run on soft-close runners.",
    price_cents: 44900, lead_time_weeks: 6, width_cm: 50, depth_cm: 40, height_cm: 55,
  },
  {
    slug: "mara-dresser",
    name: "Mara Six-Drawer Dresser",
    kind: "dresser",
    tagline: "Six deep drawers, dovetailed by hand.",
    description: "Hand-cut dovetails on every drawer box and solid timber runners. Anti-tip strap included.",
    price_cents: 149500, lead_time_weeks: 8, width_cm: 120, depth_cm: 50, height_cm: 82,
  },
  {
    slug: "mara-wardrobe",
    name: "Mara Wardrobe",
    kind: "wardrobe",
    tagline: "Hanging rail, shelves and doors that close with a whisper.",
    description: "A full-height hanging rail on one side and five shelves on the other. Delivered flat and assembled in your room.",
    price_cents: 219500, lead_time_weeks: 9, width_cm: 100, depth_cm: 62, height_cm: 203,
  },
  {
    slug: "aura-floor-mirror",
    name: "Aura Floor Mirror",
    kind: "mirror",
    tagline: "A full-length mirror that leans, framed in solid timber.",
    description: "Copper-free silvered glass in a solid timber frame. Leans against the wall with a hidden safety strap.",
    price_cents: 47900, lead_time_weeks: 4, width_cm: 70, depth_cm: 30, height_cm: 180,
  },
  {
    slug: "kiri-bench",
    name: "Kiri Bench",
    kind: "bench",
    tagline: "At the foot of the bed or along the dining table.",
    description: "An upholstered seat on a solid timber frame with panel legs. Seats two at a table.",
    price_cents: 54900, lead_time_weeks: 5, width_cm: 120, depth_cm: 40, height_cm: 45,
  },
  {
    slug: "luma-table-lamp",
    name: "Luma Table Lamp",
    kind: "tableLamp",
    tagline: "A small pool of warm light for the bedside or desk.",
    description: "A solid metal ball base with a linen shade. Dimmable warm LED, inline switch.",
    price_cents: 19900, lead_time_weeks: 3, width_cm: 30, depth_cm: 30, height_cm: 46,
  },
  {
    slug: "fen-dining-table",
    name: "Fen Dining Table",
    kind: "diningTable",
    tagline: "Seats six, built to be handed down.",
    description: "A 40 mm solid timber top on a mortise-and-tenon base. Seats six comfortably, eight at a squeeze.",
    price_cents: 209500, lead_time_weeks: 9, width_cm: 180, depth_cm: 90, height_cm: 75,
  },
  {
    slug: "fen-dining-chair",
    name: "Fen Dining Chair",
    kind: "diningChair",
    tagline: "A padded seat for long dinners.",
    description: "Solid timber frame, curved back rail and an upholstered seat. Stackable two high for storage.",
    price_cents: 32900, lead_time_weeks: 6, width_cm: 46, depth_cm: 50, height_cm: 83,
  },
  {
    slug: "fen-sideboard",
    name: "Fen Sideboard",
    kind: "sideboard",
    tagline: "Four doors for plates, glasses and the good linen.",
    description: "Adjustable shelves behind four solid doors. Cutlery tray included in the left cupboard.",
    price_cents: 174900, lead_time_weeks: 8, width_cm: 160, depth_cm: 45, height_cm: 80,
  },
  {
    slug: "tali-counter-stool",
    name: "Tali Counter Stool",
    kind: "barStool",
    tagline: "A round timber seat for the kitchen island.",
    description: "Seat height 74 cm for standard kitchen counters. Steel frame with a footrest on all four sides.",
    price_cents: 22900, lead_time_weeks: 4, width_cm: 38, depth_cm: 38, height_cm: 76,
  },
  {
    slug: "atlas-desk",
    name: "Atlas Desk",
    kind: "desk",
    tagline: "A clear desk with one good drawer.",
    description: "A deep solid timber top on slim steel legs, with a single drawer for the things that clutter a desk.",
    price_cents: 99500, lead_time_weeks: 6, width_cm: 140, depth_cm: 70, height_cm: 75,
  },
  {
    slug: "atlas-task-chair",
    name: "Atlas Task Chair",
    kind: "officeChair",
    tagline: "All-day support that doesn't look like office furniture.",
    description: "Height-adjustable seat, tilting back and padded arms, upholstered in Atelier fabrics instead of mesh.",
    price_cents: 69900, lead_time_weeks: 5, width_cm: 62, depth_cm: 62, height_cm: 108,
  },
];

export const SEED_MATERIALS: {
  slug: string;
  name: string;
  role: "fabric" | "wood" | "metal";
  hex: string;
  note: string;
}[] = [
  { slug: "boucle-ivory", name: "Bouclé Ivory", role: "fabric", hex: "#e8e0d2", note: "Looped wool, Italy" },
  { slug: "sage-linen", name: "Sage Linen", role: "fabric", hex: "#9aa78c", note: "Washed Belgian linen" },
  { slug: "terracotta-velvet", name: "Terracotta Velvet", role: "fabric", hex: "#b65a3a", note: "Cotton velvet" },
  { slug: "midnight-wool", name: "Midnight Wool", role: "fabric", hex: "#2c3447", note: "Felted merino" },
  { slug: "ochre-chenille", name: "Ochre Chenille", role: "fabric", hex: "#c9963d", note: "Soft-touch chenille" },
  { slug: "white-oak", name: "White Oak", role: "wood", hex: "#d2b48c", note: "FSC European oak" },
  { slug: "smoked-walnut", name: "Smoked Walnut", role: "wood", hex: "#6b4a33", note: "American black walnut" },
  { slug: "ebonized-ash", name: "Ebonized Ash", role: "wood", hex: "#2a2522", note: "Iron-stained ash" },
  { slug: "brushed-steel", name: "Brushed Steel", role: "metal", hex: "#b9b8b4", note: "Satin finish" },
  { slug: "aged-brass", name: "Aged Brass", role: "metal", hex: "#b08d57", note: "Living finish" },
  { slug: "black-steel", name: "Black Steel", role: "metal", hex: "#2b2b2b", note: "Powder coat" },
];

export const CATEGORIES = [
  { slug: "seating", name: "Seating" },
  { slug: "tables", name: "Tables" },
  { slug: "beds", name: "Beds" },
  { slug: "storage", name: "Storage" },
  { slug: "lighting", name: "Lighting" },
  { slug: "decor", name: "Rugs & mirrors" },
] as const;

export const ROOMS = [
  { slug: "living", name: "Living room" },
  { slug: "bedroom", name: "Bedroom" },
  { slug: "dining", name: "Dining" },
  { slug: "office", name: "Home office" },
] as const;

export const SEED_EXTRAS: Record<string, { category: string; rooms: string[]; details: string[]; care: string }> = {
  "loma-sofa": {
    rooms: ["living"],
    category: "seating",
    details: [
      "Kiln-dried solid oak frame with mortise-and-tenon joints",
      "Eight-way hand-tied steel springs",
      "Feather-wrapped high-resilience foam cushions",
      "Removable, dry-cleanable covers",
      "Seat height 44 cm · seat depth 62 cm",
    ],
    care: "Plump cushions weekly. Vacuum with a soft brush. Blot spills immediately; professional clean only.",
  },
  "ondo-lounge-chair": {
    rooms: ["living", "bedroom"],
    category: "seating",
    details: [
      "Solid timber base, oiled by hand",
      "Back reclined at 12° for reading",
      "Pocket-sprung seat cushion",
      "Removable covers with concealed zips",
    ],
    care: "Rotate the seat cushion monthly. Vacuum gently. Re-oil the base once a year.",
  },
  "halo-coffee-table": {
    rooms: ["living"],
    category: "tables",
    details: [
      "Solid timber top, 40 mm thick",
      "Floating lower shelf",
      "Powder-coated steel legs with felt glides",
      "Hard-wax oil finish, food safe",
    ],
    care: "Wipe with a damp cloth. Use coasters for hot drinks. Refresh with hard-wax oil when the surface looks dry.",
  },
  "vela-floor-lamp": {
    rooms: ["living", "bedroom", "office"],
    category: "lighting",
    details: [
      "Hand-sewn Belgian linen shade",
      "Brushed steel stem, weighted base",
      "Dimmable 2700K LED, E27 fitting",
      "Foot switch, 2.5 m fabric cable",
    ],
    care: "Dust the shade with a lint roller. Switch off and let the bulb cool before handling.",
  },
  "arca-bookshelf": {
    rooms: ["living", "office"],
    category: "storage",
    details: [
      "Five shelves, each rated to 30 kg",
      "Wedged through-tenon joinery, no screws",
      "Knocks down flat in under 10 minutes",
      "Wall strap included",
    ],
    care: "Dust weekly. Always use the wall strap. Keep out of direct radiator heat.",
  },
  "pip-side-table": {
    rooms: ["living", "bedroom"],
    category: "tables",
    details: ["Turned solid timber top", "Steel pedestal and weighted base", "Weighs 6 kg, easy to carry"],
    care: "Wipe with a damp cloth. Avoid standing water on the timber.",
  },
  "bruma-corner-sofa": {
    rooms: ["living"], category: "seating",
    details: ["Right-hand chaise as standard", "Kiln-dried oak frame, hand-tied springs", "Feather-wrapped seat cushions", "Seat depth 62 cm · chaise length 142 cm"],
    care: "Plump and rotate cushions weekly. Vacuum with a soft brush. Professional clean only.",
  },
  "linea-media-console": {
    rooms: ["living"], category: "storage",
    details: ["Three push-to-open doors", "Adjustable shelves", "Rear cable channel", "Takes screens up to 85 in / 60 kg"],
    care: "Dust with a dry cloth. Keep ventilation gaps clear behind electronics.",
  },
  "nido-pouf": {
    rooms: ["living", "bedroom"], category: "seating",
    details: ["High-density foam core", "Turned timber base", "Covered button top"],
    care: "Vacuum gently. Blot spills immediately.",
  },
  "terra-wool-rug": {
    rooms: ["living", "bedroom", "dining"], category: "decor",
    details: ["100% New Zealand wool pile", "Hand-tufted, cotton backing", "200 × 300 cm, 12 mm pile"],
    care: "Vacuum weekly without the beater bar. Rotate every six months. Professional clean once a year.",
  },
  "vale-console-table": {
    rooms: ["living"], category: "tables",
    details: ["Only 35 cm deep", "Lower shelf for baskets or shoes", "Wall-fixing bracket included"],
    care: "Wipe with a damp cloth. Use felt pads under ceramics.",
  },
  "sora-bed": {
    rooms: ["bedroom"], category: "beds",
    details: ["UK king size — fits a standard 150 × 200 cm mattress", "Double (135 × 190) and super king (180 × 200) made to order", "Solid timber slats with centre rail", "Upholstered headboard, 108 cm high", "Under-bed clearance 14 cm"],
    care: "Vacuum the headboard monthly. Tighten frame bolts once a year.",
  },
  "sora-bedside-table": {
    rooms: ["bedroom"], category: "tables",
    details: ["Two dovetailed drawers", "Soft-close runners", "Top sits level with the Sora mattress"],
    care: "Wipe with a damp cloth. Use a coaster for water glasses.",
  },
  "mara-dresser": {
    rooms: ["bedroom"], category: "storage",
    details: ["Six hand-dovetailed drawers", "Solid timber runners", "Anti-tip wall strap included"],
    care: "Dust weekly. Always fit the wall strap. Re-oil the top yearly.",
  },
  "mara-wardrobe": {
    rooms: ["bedroom"], category: "storage",
    details: ["Full-height hanging rail", "Five adjustable shelves", "Soft-close hinges", "Assembled in your room by our team"],
    care: "Dust weekly. Keep away from damp external walls.",
  },
  "aura-floor-mirror": {
    rooms: ["bedroom", "living"], category: "decor",
    details: ["Copper-free silvered glass", "Solid timber frame", "Hidden wall safety strap"],
    care: "Clean glass with a soft cloth and glass cleaner sprayed onto the cloth, never onto the frame.",
  },
  "kiri-bench": {
    rooms: ["bedroom", "dining"], category: "seating",
    details: ["Seats two at a dining table", "Upholstered seat pad", "Solid panel legs and stretcher"],
    care: "Vacuum the seat. Wipe the frame with a damp cloth.",
  },
  "luma-table-lamp": {
    rooms: ["bedroom", "living", "office"], category: "lighting",
    details: ["Linen shade", "Solid metal base", "Dimmable 2700K LED, inline switch"],
    care: "Dust the shade with a lint roller.",
  },
  "fen-dining-table": {
    rooms: ["dining"], category: "tables",
    details: ["Seats six (eight at a squeeze)", "40 mm solid timber top", "Mortise-and-tenon base", "Leg clearance 67 cm"],
    care: "Use mats for hot dishes. Wipe spills straight away. Re-oil every 6–12 months.",
  },
  "fen-dining-chair": {
    rooms: ["dining", "office"], category: "seating",
    details: ["Upholstered seat", "Curved solid back rail", "Stacks two high", "Seat height 48 cm"],
    care: "Vacuum the seat. Wipe the frame with a damp cloth.",
  },
  "fen-sideboard": {
    rooms: ["dining", "living"], category: "storage",
    details: ["Four solid doors", "Adjustable shelves", "Cutlery tray included"],
    care: "Dust weekly. Use mats under vases and plants.",
  },
  "tali-counter-stool": {
    rooms: ["dining"], category: "seating",
    details: ["Seat height 74 cm for standard 90 cm worktops", "Footrest on all four sides", "Felt floor glides"],
    care: "Wipe with a damp cloth. Re-oil the seat yearly.",
  },
  "atlas-desk": {
    rooms: ["office"], category: "tables",
    details: ["Deep 70 cm top for two screens", "Single drawer", "Rear cable gap"],
    care: "Use a desk mat under a mouse. Re-oil the top yearly.",
  },
  "atlas-task-chair": {
    rooms: ["office"], category: "seating",
    details: ["Gas-lift height adjustment", "Tilting, lockable back", "Padded arms", "Soft casters for hard floors"],
    care: "Vacuum the upholstery. Wipe the base with a damp cloth.",
  },
};


// Sample reviews so the review UI is populated in demos. Stored with is_demo = true.
export const SEED_REVIEWS: { slug: string; author: string; rating: number; title: string; body: string }[] = [
  { slug: "loma-sofa", author: "Sample reviewer", rating: 5, title: "Deep enough to nap on", body: "The seat depth is generous and the cushions keep their shape. Delivery team assembled it in ten minutes." },
  { slug: "loma-sofa", author: "Sample reviewer", rating: 4, title: "Beautiful linen", body: "Sage linen is softer than the swatch suggested. Took eight weeks as promised." },
  { slug: "ondo-lounge-chair", author: "Sample reviewer", rating: 5, title: "My reading chair now", body: "The recline is just right and the arms are wide enough for a mug." },
  { slug: "halo-coffee-table", author: "Sample reviewer", rating: 5, title: "Solid and calm", body: "Heavier than it looks, in a good way. The lower shelf holds all our books." },
  { slug: "vela-floor-lamp", author: "Sample reviewer", rating: 4, title: "Warm evening light", body: "Exactly the glow we wanted. I'd like a slightly longer cable." },
  { slug: "arca-bookshelf", author: "Sample reviewer", rating: 5, title: "No tools needed", body: "Went together in minutes and feels rock solid with the wall strap." },
  { slug: "sora-bed", author: "Sample reviewer", rating: 5, title: "Best sleep in years", body: "Solid, silent frame and the headboard is perfect for reading." },
  { slug: "fen-dining-table", author: "Sample reviewer", rating: 5, title: "The centre of our home", body: "We fit eight at Christmas. The oak top is beautiful." },
  { slug: "mara-dresser", author: "Sample reviewer", rating: 4, title: "Drawers glide perfectly", body: "Lovely joinery. Took nine weeks rather than eight." },
  { slug: "atlas-task-chair", author: "Sample reviewer", rating: 4, title: "Comfortable and good looking", body: "Doesn't look like office furniture, which was the point." },
];
