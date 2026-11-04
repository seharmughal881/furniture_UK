import { z } from "zod";
import { COMPANY } from "@/lib/company";
import { DELIVERY, formatPrice } from "@/lib/types";
import { link, text, type Field } from "./fields";

/**
 * Every editable block of the storefront: its shape, its form, and its original value.
 *
 * The `default` of each block is the exact content that used to be hardcoded in the
 * component. A block with no row in site_content renders its default, so the site looks
 * identical until the owner changes something — and deleting a row is a true "reset".
 *
 * The icon names in the trust and steps lists refer to the line-drawn SVGs defined in
 * TrustSections.tsx. They are a fixed set because each one is hand-drawn artwork, not
 * something that can be typed in, so they are offered as a dropdown.
 */

const ICON_OPTIONS = [
  { value: "cash", label: "Banknote" },
  { value: "truck", label: "Delivery van" },
  { value: "returns", label: "Return arrow" },
  { value: "store", label: "Showroom" },
  { value: "cube", label: "3D cube" },
  { value: "chat", label: "Chat bubble" },
];

const ICONS = ["cash", "truck", "returns", "store", "cube", "chat"] as const;

export type BlockGroup = "Home page" | "Navigation & footer" | "Pages" | "Business details";

export type Block = {
  key: string;
  group: BlockGroup;
  label: string;
  description: string;
  fields: Field[];
  schema: z.ZodType;
  default: unknown;
};

/** Every block, keyed. Order within a group is the order shown in the admin. */
export const BLOCKS: Block[] = [
  // ------------------------------------------------------------------ home page
  {
    key: "announcement",
    group: "Navigation & footer",
    label: "Announcement bar",
    description: "The thin strip above the header, on every page.",
    fields: [
      { kind: "boolean", name: "enabled", label: "Show the announcement bar" },
      { kind: "text", name: "message", label: "Message", max: 160 },
      {
        kind: "text",
        name: "extra",
        label: "Extra message",
        help: "Hidden on small phones, where there is no room for it.",
        max: 200,
      },
      {
        kind: "text",
        name: "messageAr",
        label: "Message in Arabic (optional)",
        // Honest about the current state: the field is saved, but the storefront has no
        // language switcher yet, so nothing displays it. Promising otherwise would have
        // the owner translating copy that never appears.
        help: "Saved for when the site gains an Arabic version. Not shown to visitors yet.",
        max: 200,
      },
    ],
    schema: z.object({
      enabled: z.boolean(),
      message: text(160),
      extra: text(200),
      messageAr: text(200),
    }),
    default: {
      enabled: true,
      message: `Free delivery on orders over ${formatPrice(DELIVERY.freeOverCents).replace(".000", "")}`,
      extra: ` · Delivered in ${DELIVERY.days} across Oman · Order on WhatsApp`,
      messageAr: "",
    },
  },
  {
    key: "trust",
    group: "Home page",
    label: "Why choose us",
    description: "The four promises shown under the hero.",
    fields: [
      {
        kind: "list",
        name: "items",
        label: "Promises",
        itemLabel: "Promise",
        max: 6,
        fields: [
          { kind: "select", name: "icon", label: "Icon", options: ICON_OPTIONS },
          { kind: "text", name: "title", label: "Heading", max: 80 },
          { kind: "text", name: "text", label: "Description", max: 200 },
          { kind: "text", name: "href", label: "Links to", max: 200 },
        ],
      },
    ],
    schema: z.object({
      items: z
        .array(
          z.object({
            icon: z.enum(ICONS),
            title: text(80),
            text: text(200),
            href: link,
          }),
        )
        .max(6),
    }),
    default: {
      items: [
        { icon: "cash", title: "Pay on delivery", text: "Cash when your furniture arrives — no card needed", href: "/help#payment" },
        {
          icon: "truck",
          title: `Delivered in ${DELIVERY.days}`,
          text: `Anywhere in Oman · free over ${formatPrice(DELIVERY.freeOverCents)}`,
          href: "/help#delivery",
        },
        { icon: "returns", title: "15-day returns", text: "Unused and unassembled items, in original packaging", href: "/help#returns" },
        { icon: "store", title: "6 showrooms", text: "See it and sit on it before you buy", href: "/stores" },
      ],
    },
  },
  {
    key: "category_rail",
    group: "Home page",
    label: "Shop by category",
    description: "Headings above the draggable category rail. The tiles themselves come from your products.",
    fields: [
      { kind: "text", name: "heading", label: "Heading", max: 120 },
      {
        kind: "text",
        name: "emphasis",
        label: "Emphasised word",
        help: "Shown in the serif italic style at the end of the heading.",
        max: 60,
      },
      { kind: "textarea", name: "body", label: "Sentence underneath", max: 400, rows: 2 },
    ],
    schema: z.object({ heading: text(120), emphasis: text(60), body: text(400) }),
    default: {
      heading: "Shop by",
      emphasis: "category.",
      body: "Swipe or drag to explore — from sofa sets made in Oman to crystal chandeliers and switches.",
    },
  },
  {
    key: "room_tiles",
    group: "Home page",
    label: "Room tiles",
    description:
      "The four room squares. Each uses real product photos: give the web address of a product and its photo is used.",
    fields: [
      {
        kind: "list",
        name: "tiles",
        label: "Tiles",
        itemLabel: "Tile",
        max: 8,
        fields: [
          { kind: "text", name: "name", label: "Title", max: 60 },
          { kind: "text", name: "href", label: "Links to", max: 200 },
          {
            kind: "text",
            name: "photo",
            label: "Main photo from product",
            help: "The product's web address, e.g. atlas-sofa-set-1",
            max: 200,
          },
          { kind: "text", name: "hoverPhoto", label: "Second photo (shown on hover)", max: 200 },
          {
            kind: "select",
            name: "countBy",
            label: "Count products by",
            options: [
              { value: "room", label: "Room" },
              { value: "category", label: "Category" },
            ],
          },
          { kind: "text", name: "countValue", label: "Room or category", max: 60 },
        ],
      },
    ],
    schema: z.object({
      tiles: z
        .array(
          z.object({
            name: text(60),
            href: link,
            photo: text(200),
            hoverPhoto: text(200),
            countBy: z.enum(["room", "category"]),
            countValue: text(60),
          }),
        )
        .max(8),
    }),
    default: {
      tiles: [
        { name: "Living room", href: "/shop?room=living", photo: "atlas-sofa-set-1", hoverPhoto: "stainly-sofa-set", countBy: "room", countValue: "living" },
        { name: "Bedroom", href: "/shop?room=bedroom", photo: "euro-star-bedroom-set-10-piece", hoverPhoto: "atlanta-bedroom-set", countBy: "room", countValue: "bedroom" },
        { name: "Dining room", href: "/shop?room=dining", photo: "jafiya-dining-table-set-6-chairs-copy", hoverPhoto: "gafiya-dining-table-set-6-chairs-black-grey-copy", countBy: "room", countValue: "dining" },
        { name: "Lighting", href: "/shop?category=lighting", photo: "perry-modern-chandelier-pendant-3", hoverPhoto: "aj-ak-modern-chandelier-pendant", countBy: "category", countValue: "lighting" },
      ],
    },
  },
  {
    key: "how_to_order",
    group: "Home page",
    label: "How to order",
    description: "The numbered steps explaining how buying works.",
    fields: [
      { kind: "text", name: "heading", label: "Heading", max: 120 },
      { kind: "text", name: "emphasis", label: "Emphasised word", max: 60 },
      { kind: "text", name: "body", label: "Sentence underneath", max: 300 },
      {
        kind: "list",
        name: "steps",
        label: "Steps",
        itemLabel: "Step",
        max: 6,
        fields: [
          { kind: "select", name: "icon", label: "Icon", options: ICON_OPTIONS },
          { kind: "text", name: "title", label: "Title", max: 80 },
          { kind: "textarea", name: "text", label: "Description", max: 300, rows: 2 },
        ],
      },
    ],
    schema: z.object({
      heading: text(120),
      emphasis: text(60),
      body: text(300),
      steps: z.array(z.object({ icon: z.enum(ICONS), title: text(80), text: text(300) })).max(6),
    }),
    default: {
      heading: "Ordering is",
      emphasis: "easy.",
      body: "No account, no card, no surprises.",
      steps: [
        { icon: "cube", title: "Choose", text: "Browse photos, turn furniture in 3D and try fabrics, or plan your whole room." },
        { icon: "chat", title: "Order your way", text: "Check out online in under a minute, or send your basket to us on WhatsApp." },
        { icon: "cash", title: "Pay when it arrives", text: `We call to confirm, deliver in ${DELIVERY.days}, and you pay cash on delivery.` },
      ],
    },
  },
  {
    key: "planner_teaser",
    group: "Home page",
    label: "Room planner teaser",
    description: "The dark band with the slowly rotating 3D room.",
    fields: [
      { kind: "boolean", name: "enabled", label: "Show this section" },
      { kind: "text", name: "label", label: "Small label", max: 60 },
      { kind: "text", name: "heading", label: "Heading", max: 120 },
      { kind: "text", name: "emphasis", label: "Emphasised words", max: 60 },
      { kind: "text", name: "headingEnd", label: "Heading after the emphasis", max: 60 },
      { kind: "textarea", name: "body", label: "Paragraph", max: 600, rows: 3 },
      { kind: "text", name: "buttonLabel", label: "Button text", max: 60 },
    ],
    schema: z.object({
      enabled: z.boolean(),
      label: text(60),
      heading: text(120),
      emphasis: text(60),
      headingEnd: text(60),
      body: text(600),
      buttonLabel: text(60),
    }),
    default: {
      enabled: true,
      label: "Room planner",
      heading: "Plan your room.",
      emphasis: "Save it.",
      headingEnd: "Order it.",
      body: "Drag our real sofa sets, bedroom sets and dining tables onto a floor plan, turn them, and watch the light change from afternoon to night. Share the layout with family, or add the whole room to your basket.",
      buttonLabel: "Open the planner →",
    },
  },
  {
    key: "showroom_map",
    group: "Home page",
    label: "Showroom map",
    description:
      "The schematic map of showrooms. Positions are percentages across the panel — it is a diagram, not a real map.",
    fields: [
      { kind: "text", name: "label", label: "Small label", max: 60 },
      { kind: "text", name: "heading", label: "Heading", max: 120 },
      { kind: "text", name: "emphasis", label: "Emphasised words", max: 60 },
      { kind: "textarea", name: "body", label: "Paragraph", max: 600, rows: 3 },
      { kind: "text", name: "buttonLabel", label: "Button text", max: 60 },
      {
        kind: "list",
        name: "cities",
        label: "Places on the map",
        itemLabel: "Place",
        help: "The first one is the head office, which the delivery lines radiate from.",
        max: 20,
        fields: [
          { kind: "text", name: "name", label: "Label", max: 80 },
          { kind: "number", name: "x", label: "Across (0–100)", min: 0, max: 100 },
          { kind: "number", name: "y", label: "Down (0–100)", min: 0, max: 100 },
          {
            kind: "select",
            name: "side",
            label: "Label sits",
            options: [
              { value: "r", label: "Right" },
              { value: "l", label: "Left" },
              { value: "t", label: "Above" },
              { value: "b", label: "Below" },
            ],
          },
          { kind: "boolean", name: "office", label: "Head office" },
        ],
      },
    ],
    schema: z.object({
      label: text(60),
      heading: text(120),
      emphasis: text(60),
      body: text(600),
      buttonLabel: text(60),
      cities: z
        .array(
          z.object({
            name: text(80),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            side: z.enum(["r", "l", "t", "b"]),
            office: z.boolean(),
          }),
        )
        .max(20),
    }),
    default: {
      label: "Showrooms",
      heading: "Real showrooms,",
      emphasis: "near you.",
      body: "Visit Muscat Furniture in Al Hail North, Sohar, Barka, Al-Bidaya, Nizwa and Salalah — or order online and we deliver from Muscat to every governorate.",
      buttonLabel: "Find a showroom →",
      cities: [
        { name: "Muscat · head office", x: 84, y: 44, side: "b", office: true },
        { name: "Al Hail North", x: 70, y: 34, side: "t", office: false },
        { name: "Barka", x: 56, y: 40, side: "b", office: false },
        { name: "Al-Bidaya", x: 42, y: 30, side: "t", office: false },
        { name: "Sohar", x: 22, y: 18, side: "r", office: false },
        { name: "Nizwa", x: 60, y: 62, side: "r", office: false },
        { name: "Salalah", x: 26, y: 86, side: "r", office: false },
      ],
    },
  },

  // ------------------------------------------------------------------ nav & footer
  {
    key: "nav",
    group: "Navigation & footer",
    label: "Header & mega-menu",
    description: "The main links, and the groups of categories inside the Shop menu.",
    fields: [
      {
        kind: "list",
        name: "links",
        label: "Main links",
        itemLabel: "Link",
        help: "Shown next to the Shop menu.",
        max: 8,
        fields: [
          { kind: "text", name: "label", label: "Text", max: 60 },
          { kind: "text", name: "href", label: "Links to", max: 200 },
        ],
      },
      {
        kind: "list",
        name: "departments",
        label: "Shop menu groups",
        itemLabel: "Group",
        max: 8,
        fields: [
          { kind: "text", name: "title", label: "Group heading", max: 60 },
          {
            kind: "text",
            name: "categories",
            label: "Categories",
            help: "Category web addresses, separated by commas, e.g. sofas, tables, decor",
            max: 300,
          },
        ],
      },
    ],
    schema: z.object({
      links: z.array(z.object({ label: text(60), href: link })).max(8),
      departments: z.array(z.object({ title: text(60), categories: text(300) })).max(8),
    }),
    default: {
      links: [
        { label: "Room planner", href: "/planner" },
        { label: "Showrooms", href: "/stores" },
        { label: "Delivery & returns", href: "/help" },
      ],
      departments: [
        { title: "Living room", categories: "sofas, tables, decor" },
        { title: "Bedroom", categories: "bedroom-sets, beds, storage, mattresses, bedding" },
        { title: "Dining", categories: "dining" },
        { title: "Lighting & electrical", categories: "lighting, switches, sanitary" },
      ],
    },
  },
  {
    key: "footer",
    group: "Navigation & footer",
    label: "Footer",
    description: "The big line, the link columns and the small print.",
    fields: [
      { kind: "text", name: "bigLine", label: "Big line", max: 120 },
      { kind: "text", name: "bigLineEmphasis", label: "Big line, emphasised part", max: 120 },
      {
        kind: "list",
        name: "showrooms",
        label: "Showroom links",
        itemLabel: "Showroom",
        max: 20,
        fields: [{ kind: "text", name: "name", label: "Name", max: 80 }],
      },
      {
        kind: "list",
        name: "help",
        label: "Help column",
        itemLabel: "Link",
        max: 10,
        fields: [
          { kind: "text", name: "label", label: "Text", max: 80 },
          { kind: "text", name: "href", label: "Links to", max: 200 },
        ],
      },
      { kind: "text", name: "finePrint", label: "Small print, left", max: 200 },
      { kind: "text", name: "finePrintRight", label: "Small print, right", max: 200 },
    ],
    schema: z.object({
      bigLine: text(120),
      bigLineEmphasis: text(120),
      showrooms: z.array(z.object({ name: text(80) })).max(20),
      help: z.array(z.object({ label: text(80), href: link })).max(10),
      finePrint: text(200),
      finePrintRight: text(200),
    }),
    default: {
      bigLine: "See it first,",
      bigLineEmphasis: "love it at home.",
      showrooms: [
        { name: "Muscat (Al Hail North)" },
        { name: "Sohar" },
        { name: "Barka" },
        { name: "Al-Bidaya" },
        { name: "Nizwa" },
        { name: "Salalah" },
      ],
      help: [
        { label: "Delivery across Oman", href: "/help#delivery" },
        { label: "Returns & exchanges", href: "/help#returns" },
        { label: "Cash on delivery", href: "/help#payment" },
        { label: "Room planner", href: "/planner" },
      ],
      finePrint: `© 2026 ${COMPANY.tradingName}. Prices in Omani rials, VAT included.`,
      finePrintRight: "3D previews are rendered live in your browser.",
    },
  },

  // ------------------------------------------------------------------ business details
  {
    key: "company",
    group: "Business details",
    label: "Contact & legal details",
    description:
      "Used in the footer, on the contact and legal pages, and by every “Order on WhatsApp” button.",
    fields: [
      { kind: "text", name: "tradingName", label: "Trading name", max: 120 },
      { kind: "text", name: "tradingNameAr", label: "Trading name in Arabic", max: 120 },
      { kind: "text", name: "legalName", label: "Registered company name", max: 200 },
      { kind: "text", name: "crNumber", label: "Commercial registration (CR) number", max: 60 },
      {
        kind: "text",
        name: "licenceNumber",
        label: "E-commerce licence number",
        help: "Oman's Ministerial Decision 499/2023 expects this to be shown.",
        max: 60,
      },
      { kind: "text", name: "vatNumber", label: "VAT registration number", max: 60 },
      { kind: "textarea", name: "address", label: "Address", max: 400, rows: 2 },
      { kind: "text", name: "phone", label: "Phone", max: 40 },
      {
        kind: "text",
        name: "whatsapp",
        label: "WhatsApp number",
        help: "Digits only, including the country code, e.g. 96893993950",
        max: 20,
      },
      { kind: "text", name: "email", label: "Orders email", max: 200 },
      { kind: "text", name: "complaintsEmail", label: "Complaints email", max: 200 },
      { kind: "text", name: "instagram", label: "Instagram address", max: 300 },
      { kind: "text", name: "facebook", label: "Facebook address", max: 300 },
    ],
    schema: z.object({
      tradingName: text(120),
      tradingNameAr: text(120),
      legalName: text(200),
      crNumber: text(60),
      licenceNumber: text(60),
      vatNumber: text(60),
      address: text(400),
      phone: text(40),
      whatsapp: z
        .string()
        .trim()
        .max(20)
        .refine((s) => /^\d{8,20}$/.test(s), "Digits only, including the country code"),
      email: text(200),
      complaintsEmail: text(200),
      instagram: link,
      facebook: link,
    }),
    default: {
      tradingName: COMPANY.tradingName,
      tradingNameAr: COMPANY.tradingNameAr,
      legalName: COMPANY.legalName,
      crNumber: COMPANY.crNumber,
      licenceNumber: COMPANY.licenceNumber,
      vatNumber: COMPANY.vatNumber,
      address: COMPANY.address,
      phone: COMPANY.phone,
      whatsapp: COMPANY.whatsapp,
      email: COMPANY.email,
      complaintsEmail: COMPANY.complaintsEmail,
      instagram: COMPANY.instagram,
      facebook: COMPANY.facebook,
    },
  },
  {
    key: "seo",
    group: "Business details",
    label: "Search engines & sharing",
    description: "The title and description search engines show, and the picture used when a link is shared.",
    fields: [
      { kind: "text", name: "title", label: "Home page title", max: 200 },
      {
        kind: "text",
        name: "titleTemplate",
        label: "Other pages' title",
        help: "%s is replaced by the page's own name.",
        max: 120,
      },
      { kind: "textarea", name: "description", label: "Description", max: 400, rows: 3 },
      { kind: "image", name: "shareImage", label: "Sharing picture", help: "Shown when someone shares a link." },
    ],
    schema: z.object({
      title: text(200),
      titleTemplate: text(120),
      description: text(400),
      shareImage: link,
    }),
    default: {
      title: "Muscat Furniture — Sofas, bedroom sets, lighting | Oman",
      titleTemplate: "%s — Muscat Furniture",
      description:
        "Sofa sets, bedroom sets, dining, mattresses and lighting from Muscat Furniture. See furniture in 3D, plan your room, order online or on WhatsApp — delivered across Oman.",
      shareImage: "",
    },
  },
];

export const BLOCK_MAP = new Map(BLOCKS.map((b) => [b.key, b]));

export const GROUPS: BlockGroup[] = ["Home page", "Navigation & footer", "Pages", "Business details"];

/** Typed accessor for a block's default, for the storefront readers. */
export function blockDefault<T>(key: string): T {
  const block = BLOCK_MAP.get(key);
  if (!block) throw new Error(`Unknown content block: ${key}`);
  return block.default as T;
}
