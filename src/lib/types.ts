import type { FurnitureKind } from "@/three/furniture";

export type Product = {
  id: number;
  slug: string;
  name: string;
  kind: FurnitureKind;
  tagline: string;
  description: string;
  priceCents: number;
  leadTimeWeeks: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  category: string;
  rooms: string[];
  details: string[];
  care: string;
  rating: number | null;
  reviewCount: number;
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
  kind: FurnitureKind;
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

export type RoomItem = { id: string; kind: FurnitureKind; x: number; z: number; rot: number };

/** All prices are in pence and include UK VAT (Price Marking Order 2004: consumer prices must include VAT). */
export const formatPrice = (pence: number, exact = false) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: exact ? 2 : 0,
    maximumFractionDigits: exact ? 2 : 0,
  }).format(pence / 100);

export const VAT_RATE = 0.2;
/** The VAT contained in a VAT-inclusive amount (1/6 of the gross at 20%). */
export const vatIncluded = (grossPence: number) => Math.round(grossPence - grossPence / (1 + VAT_RATE));

// One price for every UK address, including the Highlands, islands and Northern Ireland.
// (ASA/CAP: "UK delivery" claims must cover the whole UK; surcharges must be stated up front.)
export const SHIPPING = {
  standard: { label: "Standard delivery", note: "Two-person team to your door, any UK address", cents: 7900, freeOverCents: 100000 },
  whiteGlove: { label: "White-glove delivery", note: "Room of your choice, assembled, packaging taken away", cents: 19900, freeOverCents: null },
} as const;
export type ShippingMethod = keyof typeof SHIPPING;

export const shippingCost = (method: ShippingMethod, subtotalCents: number) => {
  const m = SHIPPING[method];
  return m.freeOverCents !== null && subtotalCents >= m.freeOverCents ? 0 : m.cents;
};
