import { z } from "zod";
import { KINDS } from "@/three/furniture";

export const roomItemSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(KINDS),
  x: z.number().min(-10).max(10),
  z: z.number().min(-10).max(10),
  rot: z.number().min(-100).max(100),
});

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80).default("My room"),
  layout: z.array(roomItemSchema).max(60),
});

export const inquirySchema = z.object({
  productSlug: z.string().min(1).max(80),
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
    .array(z.object({ productSlug: z.string().min(1).max(80), quantity: z.number().int().min(1).max(20), config }))
    .min(1)
    .max(60),
});

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(0).max(20) });

// UK postcode, e.g. "SW1A 1AA", "M1 1AE", "EH99 1SP" (spaces optional, any case).
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})$/i;
export const normalisePostcode = (pc: string) => pc.trim().toUpperCase().replace(UK_POSTCODE, "$1 $2");

export const checkoutSchema = z.object({
  email: z.email().max(200),
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+44\s?|0)[\d\s]{9,13}$/, "Enter a UK phone number")
    .or(z.literal(""))
    .default(""),
  address: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(1).max(120),
  county: z.string().trim().max(80).default(""),
  postcode: z.string().trim().regex(UK_POSTCODE, "Enter a valid UK postcode").transform(normalisePostcode),
  country: z.literal("United Kingdom").default("United Kingdom"),
  shippingMethod: z.enum(["standard", "whiteGlove"]),
  acceptTerms: z.literal(true, "Please accept the terms of sale"),
});

export const reviewSchema = z.object({
  productSlug: z.string().min(1).max(80),
  author: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(10).max(2000),
});

export const newsletterSchema = z.object({ email: z.email().max(200) });
