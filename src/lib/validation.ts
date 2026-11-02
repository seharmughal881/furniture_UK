import { z } from "zod";
import { GOVERNORATES } from "@/lib/catalog-data";
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
