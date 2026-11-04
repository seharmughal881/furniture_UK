import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/admin/status";
import { CATEGORIES, GOVERNORATES, ROOMS } from "@/lib/catalog-data";
import { KINDS } from "@/three/furniture";

export const roomItemSchema = z.object({
  id: z.string().min(1).max(40),
  slug: z.string().max(120).optional(),
  kind: z.enum(KINDS),
  x: z.number().min(-10).max(10),
  z: z.number().min(-10).max(10),
  rot: z.number().min(-100).max(100),
});

const HEX = /^#[0-9a-f]{6}$/i;
export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80).default("My room"),
  layout: z.array(roomItemSchema).max(60),
  style: z
    .object({ wall: z.string().regex(HEX), floor: z.string().max(20), photos: z.boolean(), mode: z.enum(["ai", "photo", "simple"]) })
    .partial()
    .default({}),
});

export const inquirySchema = z.object({
  productSlug: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  message: z.string().trim().max(2000).default(""),
  config: z.object({ fabric: z.string().max(60), wood: z.string().max(60), metal: z.string().max(60) }),
});

export const isUuid = (s: string) => z.uuid().safeParse(s).success;

export const badRequest = (error: z.ZodError) =>
  Response.json({ error: "Invalid request", issues: z.flattenError(error).fieldErrors }, { status: 400 });

const config = z.object({ fabric: z.string().max(60), wood: z.string().max(60), metal: z.string().max(60) });

export const addToCartSchema = z.object({
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1).max(120),
        quantity: z.number().int().min(1).max(20),
        variant: z.string().max(120).default(""),
        config,
      }),
    )
    .min(1)
    .max(60),
});

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(0).max(20) });

// Omani numbers: 8 digits, mobiles start with 7 or 9, landlines with 2; optional +968 / 00968.
const OMAN_PHONE = /^(?:\+?968|00968)?\s?[279]\d{3}\s?\d{4}$/;

export const checkoutSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(OMAN_PHONE, "Enter an Omani phone number, e.g. 9123 4567"),
  email: z.email().max(200).or(z.literal("")).default(""),
  governorate: z.enum(GOVERNORATES),
  wilaya: z.string().trim().min(2).max(120),
  area: z.string().trim().min(2).max(200),
  building: z.string().trim().max(200).default(""),
  landmark: z.string().trim().max(300).default(""),
  paymentMethod: z.enum(["cod"]).default("cod"),
});

export const reviewSchema = z.object({
  productSlug: z.string().min(1).max(120),
  author: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(10).max(2000),
});

export const newsletterSchema = z.object({ email: z.email().max(200) });

// ---------------------------------------------------------------- admin panel

// Login keeps the email loose on purpose: a malformed address simply will not match an
// account, and a stricter message would tell an attacker how the field is validated.
export const adminLoginSchema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(400),
  next: z.string().max(500).default(""),
});

export const orderStatusActionSchema = z.object({
  orderId: z.string().max(60),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(2000).default(""),
});

export const orderNoteActionSchema = z.object({
  orderId: z.string().max(60),
  note: z.string().trim().min(1).max(2000),
});

/** Filters for the admin order list, read straight from the URL. */
export const orderSearchSchema = z.object({
  status: z.string().trim().max(40).optional(),
  gov: z.string().trim().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
});

// ---------------------------------------------------------------- admin: products

/**
 * Prices are typed by the shop owner in rials ("475.000"), not in baisa, and converted
 * here. Spaces and thousands commas are stripped first so a pasted "1,250.000" works.
 * Everything downstream keeps using integer baisa, exactly as the products table stores it.
 */
const MAX_OMR = 9_999_999;
const RIALS = /^\d{1,7}(\.\d{1,3})?$/;
const toBaisa = (s: string) => Math.round(Number(s) * 1000);
const stripSeparators = (s: string) => s.replace(/[\s,]/g, "");

/** A price that must be given. Returns baisa. */
const moneyRequired = (label: string) =>
  z
    .string()
    .trim()
    .transform(stripSeparators)
    .refine((s) => RIALS.test(s), `${label} must be a number like 475.000`)
    .refine((s) => Number(s) <= MAX_OMR, `${label} is too large`)
    .transform(toBaisa);

/** A price that may be left blank, which means "no was-price". Returns baisa or null. */
const moneyOptional = (label: string) =>
  z
    .string()
    .trim()
    .transform(stripSeparators)
    .refine((s) => s === "" || RIALS.test(s), `${label} must be a number like 475.000`)
    .refine((s) => s === "" || Number(s) <= MAX_OMR, `${label} is too large`)
    .transform((s) => (s === "" ? null : toBaisa(s)));

/** A whole number typed into a text box; blank means "not set". */
const optionalInt = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d{1,9}$/.test(s), `${label} must be a whole number`)
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((v) => v === null || v <= max, `${label} is too large`);

/** An HTML checkbox: present and "on" when ticked, absent entirely when not. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/**
 * Only https (our Vercel Blob store and Shopify's CDN) or a site-relative path. This is
 * what stops "javascript:" and "data:" ever reaching an <img src> on the storefront.
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine((s) => s.startsWith("https://") || s.startsWith("/"), "Images must be an https:// address or a /path");

export const productSlugSchema = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .refine((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), "Use lowercase letters, numbers and hyphens only")
  .refine((s) => s.length <= 120, "Web address is too long");

/**
 * One row of the variants JSONB array.
 *
 * The editor sends prices as the rial strings the owner typed, parsed by the same
 * moneyRequired/moneyOptional helpers as the main price so there is one definition of
 * what a valid price looks like. The transform then emits exactly the snake_case shape
 * the storefront already reads out of products.variants -- see readCart() in lib/cart.ts.
 */
export const productVariantSchema = z
  .object({
    title: z.string().trim().min(1, "Every option needs a name").max(120),
    price: moneyRequired("Option price"),
    compareAt: moneyOptional("Option was-price"),
    available: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  })
  .transform((v) => ({
    title: v.title,
    price_cents: v.price,
    compare_at_cents: v.compareAt,
    available: v.available,
  }));

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const ROOM_SLUGS = ROOMS.map((r) => r.slug) as [string, ...string[]];

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "A product needs a name").max(200),
  nameAr: z.string().trim().max(200).default(""),
  slug: productSlugSchema,
  category: z.enum(CATEGORY_SLUGS),
  subcategory: z.string().trim().max(80).default(""),
  rooms: z.array(z.enum(ROOM_SLUGS)).max(ROOM_SLUGS.length).default([]),
  // "" means the product has no 3D model; KINDS comes from the procedural furniture set.
  kind: z.union([z.enum(KINDS), z.literal("")]).default(""),
  tagline: z.string().trim().max(300).default(""),
  description: z.string().trim().max(8000).default(""),
  // One bullet per line in the textarea.
  details: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  care: z.string().trim().max(2000).default(""),
  priceCents: moneyRequired("Price"),
  compareAtCents: moneyOptional("Was price"),
  stockQty: optionalInt("Stock", 1_000_000),
  inStock: checkbox,
  featured: checkbox,
  active: checkbox,
  sku: z.string().trim().max(80).default(""),
  vendor: z.string().trim().max(120).default(""),
  colour: z.string().trim().max(60).default(""),
  widthCm: optionalInt("Width", 10000),
  depthCm: optionalInt("Depth", 10000),
  heightCm: optionalInt("Height", 10000),
  leadTimeWeeks: optionalInt("Lead time", 104),
  images: z.array(imageUrlSchema).max(12).default([]),
  variants: z.array(productVariantSchema).max(40).default([]),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

/** Filters for the admin product list, read straight from the URL. */
export const productSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  room: z.string().trim().max(60).optional(),
  stock: z.enum(["in", "out"]).optional(),
  status: z.enum(["active", "archived"]).optional(),
  sort: z.enum(["recent", "name", "price-asc", "price-desc", "featured"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
});
