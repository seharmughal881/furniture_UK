import type { FurnitureKind } from "@/three/furniture";

export type Variant = { title: string; price_cents: number; compare_at_cents: number | null; available: boolean };

export type Product = {
  id: number;
  slug: string;
  name: string;
  nameAr: string;
  /** Representative 3D model for the preview, or null when the product has none (lights, switches…). */
  kind: FurnitureKind | null;
  tagline: string;
  description: string;
  /** Money is integer minor units: baisa (1 OMR = 1000 baisa). */
  priceCents: number;
  compareAtCents: number | null;
  leadTimeWeeks: number;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  category: string;
  rooms: string[];
  details: string[];
  care: string;
  rating: number | null;
  reviewCount: number;
  images: string[];
  inStock: boolean;
  featured: boolean;
  colour: string;
  sku: string;
  variants: Variant[];
};

/** Lightweight product record for menus, search and cards. */
export type ProductSummary = Pick<
  Product,
  "slug" | "name" | "nameAr" | "kind" | "category" | "rooms" | "priceCents" | "compareAtCents" | "inStock" | "colour"
> & {
  image: string | null;
  image2: string | null;
  /** true when the customer must pick a colour/size, so "quick add" sends them to the product page */
  hasOptions: boolean;
};

export type Store = {
  slug: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  kind: string;
};

export type Review = {
  id: number;
  author: string;
  rating: number;
  title: string;
  body: string;
  isDemo: boolean;
  createdAt: string;
};

export type CartLine = {
  id: number;
  slug: string;
  name: string;
  kind: FurnitureKind | null;
  image: string | null;
  variant: string;
  unitPriceCents: number;
  quantity: number;
  config: { fabric: string; wood: string; metal: string };
  leadTimeWeeks: number;
};

export type Cart = { lines: CartLine[]; count: number; subtotalCents: number };

export type MaterialRole = "fabric" | "wood" | "metal";

export type Material = {
  id: number;
  slug: string;
  name: string;
  role: MaterialRole;
  hex: string;
  note: string;
};

export type Palette = { fabric: string; wood: string; metal: string };

/** A piece in the room planner; slug is the real product it represents. */
export type RoomItem = { id: string; kind: FurnitureKind; slug?: string; x: number; z: number; rot: number };

/** Prices are stored in baisa and shown in Omani rials with 3 decimals, VAT included. */
export const formatPrice = (baisa: number) =>
  new Intl.NumberFormat("en-OM", { style: "currency", currency: "OMR", minimumFractionDigits: 3 }).format(baisa / 1000);

/** Oman VAT is 5% (since 16 April 2021); shelf prices must include it. */
export const VAT_RATE = 0.05;
/** The VAT contained in a VAT-inclusive amount. */
export const vatIncluded = (gross: number) => Math.round(gross - gross / (1 + VAT_RATE));

export const savingPercent = (price: number, compareAt: number | null) =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;

// The client's published delivery terms (muscatfurniture.com, October 2026): Oman only, 4–6 days,
// free over OMR 75; below that the fee depends on weight and destination, so the team confirms it.
export const DELIVERY = {
  freeOverCents: 75_000,
  days: "4–6 days",
  businessDays: "Saturday to Thursday, excluding public holidays",
};
/** 0 when free, null when the team must confirm the fee. */
export const deliveryFee = (subtotal: number): number | null => (subtotal >= DELIVERY.freeOverCents ? 0 : null);

/** A product photo's depth map (scripts/make-depth.ts): size, whether the background was cut out, and the product's box (0–1). */
export type DepthInfo = { w: number; h: number; cut: boolean; box: [number, number, number, number] };
