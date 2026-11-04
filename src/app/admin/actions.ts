"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resetBlock, saveBlock } from "@/lib/admin/content";
import { addOrderNote, setOrderStatus } from "@/lib/admin/orders";
import {
  createProduct,
  deleteProduct,
  setProductActive,
  setProductFlag,
  updateProduct,
} from "@/lib/admin/products";
import {
  confirmSubscriber,
  deleteReview,
  deleteSubscriber,
  rejectVisitorFlood,
  setInquiryStatus,
  setReviewStatus,
} from "@/lib/admin/moderation";
import { signIn, signOut } from "@/lib/admin/session";
import { deleteStore, saveStore } from "@/lib/admin/stores";
import { BLOCK_MAP } from "@/lib/content/blocks";
import { readFields } from "@/lib/content/fields";
import {
  adminLoginSchema,
  orderNoteActionSchema,
  orderStatusActionSchema,
  productFormSchema,
} from "@/lib/validation";

/**
 * Admin mutations, as Server Actions driven by plain <form> posts. No client-side fetch,
 * so the panel works with JavaScript disabled, and Next's own Server Action origin check
 * applies on top of the session cookie's SameSite=Strict.
 *
 * Authorisation is not repeated here: setOrderStatus and addOrderNote each call
 * requireAdmin() themselves before touching the database.
 */

/** Only ever bounce back inside the admin, so ?next= cannot become an open redirect. */
function safeNext(next: string): string {
  if (!next.startsWith("/admin")) return "/admin/orders";
  if (next.startsWith("/admin/login")) return "/admin/orders";
  // "//evil.com" and "/\evil.com" are protocol-relative URLs, not local paths.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/admin/orders";
  return next;
}

const backToLogin = (message: string, next: string) =>
  `/admin/login?error=${encodeURIComponent(message)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

export async function signInAction(formData: FormData): Promise<void> {
  const next = String(formData.get("next") ?? "");
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    next,
  });
  if (!parsed.success) redirect(backToLogin("Enter your email and password.", next));

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) redirect(backToLogin(result.error, next));

  redirect(safeNext(parsed.data.next));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login");
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const parsed = orderStatusActionSchema.safeParse({
    orderId: formData.get("orderId") ?? "",
    to: formData.get("to") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) redirect("/admin/orders?error=" + encodeURIComponent("That is not a valid status change."));

  const { orderId, to, note } = parsed.data;
  const result = await setOrderStatus(orderId, to, note);
  redirect(`/admin/orders/${orderId}${result.ok ? "" : `?error=${encodeURIComponent(result.error)}`}`);
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const parsed = orderNoteActionSchema.safeParse({
    orderId: formData.get("orderId") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) redirect("/admin/orders?error=" + encodeURIComponent("Write a note first."));

  const { orderId, note } = parsed.data;
  const result = await addOrderNote(orderId, note);
  redirect(`/admin/orders/${orderId}${result.ok ? "" : `?error=${encodeURIComponent(result.error)}`}`);
}

// ---------------------------------------------------------------- products

/**
 * Rebuild the product form's typed input from the posted FormData.
 *
 * Not exported: a "use server" module may only export async functions, and this is a
 * plain helper. Arrays arrive three different ways and each is handled here rather than
 * in the schema -- checkbox groups as repeated fields, bullet lists as one textarea line
 * per item, and images/variants as JSON from their editor components.
 */
function productInputFromForm(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  const json = (name: string) => {
    try {
      const parsed = JSON.parse(text(name) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  return {
    name: text("name"),
    nameAr: text("nameAr"),
    slug: text("slug"),
    category: text("category"),
    subcategory: text("subcategory"),
    rooms: formData.getAll("rooms").map(String),
    kind: text("kind"),
    tagline: text("tagline"),
    description: text("description"),
    details: text("details")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    care: text("care"),
    priceCents: text("price"),
    compareAtCents: text("compareAt"),
    stockQty: text("stockQty"),
    inStock: formData.get("inStock"),
    featured: formData.get("featured"),
    active: formData.get("active"),
    sku: text("sku"),
    vendor: text("vendor"),
    colour: text("colour"),
    widthCm: text("widthCm"),
    depthCm: text("depthCm"),
    heightCm: text("heightCm"),
    leadTimeWeeks: text("leadTimeWeeks"),
    images: json("images"),
    variants: json("variants"),
  };
}

export type ProductSaveState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Create or update one product. Used with useActionState, so a rejected save returns the
 * messages instead of redirecting -- the form keeps everything the user typed.
 */
export async function saveProductAction(
  _prev: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const rawId = String(formData.get("id") ?? "");
  const id = rawId ? Number(rawId) : null;
  if (rawId && !Number.isInteger(id)) return { error: "Unknown product." };

  const parsed = productFormSchema.safeParse(productInputFromForm(formData));
  if (!parsed.success) {
    return {
      error: "Please check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const result = id ? await updateProduct(id, parsed.data) : await createProduct(parsed.data);
  if (!result.ok) return { error: result.error };

  // revalidateTag, not a plain redirect: getProducts()/getProduct() cache the catalogue
  // for hours under these tags, so without this the storefront would keep serving the
  // old copy and the owner would think the save failed.
  revalidateTag("catalog", { expire: 0 });
  redirect(`/admin/products/${result.id}?saved=1`);
}

export async function setProductFlagAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const flag = String(formData.get("flag"));
  const value = String(formData.get("value")) === "true";
  const back = safeNext(String(formData.get("back") ?? "/admin/products"));

  if (!Number.isInteger(id) || (flag !== "featured" && flag !== "in_stock")) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("That change is not allowed.")}`);
  }

  const result = await setProductFlag(id, flag, value);
  if (result.ok) revalidateTag("catalog", { expire: 0 });
  redirect(result.ok ? back : `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(result.error)}`);
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  if (!Number.isInteger(id)) redirect("/admin/products?error=" + encodeURIComponent("Unknown product."));

  const result = await setProductActive(id, active);
  if (result.ok) revalidateTag("catalog", { expire: 0 });
  redirect(
    result.ok
      ? `/admin/products/${id}?saved=1`
      : `/admin/products/${id}?error=${encodeURIComponent(result.error)}`,
  );
}

/**
 * Delete, which quietly becomes "archive" for a product that appears on an order -- see
 * deleteProduct(). The admin is told which of the two happened.
 */
export async function deleteProductAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/admin/products?error=" + encodeURIComponent("Unknown product."));

  const result = await deleteProduct(id);
  if (!result.ok) redirect(`/admin/products/${id}?error=${encodeURIComponent(result.error)}`);

  revalidateTag("catalog", { expire: 0 });
  redirect(
    result.archived
      ? `/admin/products?notice=${encodeURIComponent("That product is on an order, so it was archived rather than deleted.")}`
      : `/admin/products?notice=${encodeURIComponent("Product deleted.")}`,
  );
}

// ---------------------------------------------------------------- moderation

const backTo = (path: string, message?: string) =>
  message ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}` : path;

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision"));
  const back = safeNext(String(formData.get("back") ?? "/admin/reviews"));
  if (!Number.isInteger(id)) redirect(backTo(back, "Unknown review."));

  if (decision === "delete") {
    const result = await deleteReview(id);
    redirect(result.ok ? back : backTo(back, result.error));
  }
  if (decision === "flood") {
    const result = await rejectVisitorFlood(id);
    redirect(
      result.ok
        ? `${back}${back.includes("?") ? "&" : "?"}notice=${encodeURIComponent(`Rejected ${result.count} reviews from that visitor.`)}`
        : backTo(back, result.error),
    );
  }
  if (decision !== "approved" && decision !== "rejected" && decision !== "pending") {
    redirect(backTo(back, "Unknown decision."));
  }

  const result = await setReviewStatus(id, decision);
  redirect(result.ok ? back : backTo(back, result.error));
}

export async function updateInquiryAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  const note = String(formData.get("note") ?? "");
  const back = safeNext(String(formData.get("back") ?? "/admin/inquiries"));
  if (!Number.isInteger(id)) redirect(backTo(back, "Unknown enquiry."));
  if (status !== "new" && status !== "answered" && status !== "closed") {
    redirect(backTo(back, "Unknown status."));
  }

  const result = await setInquiryStatus(id, status, note);
  redirect(result.ok ? back : backTo(back, result.error));
}

export async function subscriberAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const what = String(formData.get("what"));
  const back = safeNext(String(formData.get("back") ?? "/admin/subscribers"));

  const result = what === "delete" ? await deleteSubscriber(email) : await confirmSubscriber(email);
  redirect(result.ok ? back : backTo(back, result.error));
}

// ---------------------------------------------------------------- site content

export type ContentSaveState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  saved?: boolean;
};

/**
 * Save one editable content block. Used with useActionState so a rejected save keeps
 * everything the owner typed rather than throwing their work away.
 */
export async function saveContentAction(
  _prev: ContentSaveState,
  formData: FormData,
): Promise<ContentSaveState> {
  const key = String(formData.get("key") ?? "");
  const block = BLOCK_MAP.get(key);
  if (!block) return { error: "Unknown section." };

  const result = await saveBlock(key, readFields(block.fields, formData));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };

  redirect(`/admin/content/${key}?saved=1`);
}

export async function resetContentAction(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "");
  const result = await resetBlock(key);
  redirect(
    result.ok
      ? `/admin/content/${key}?reset=1`
      : `/admin/content/${key}?error=${encodeURIComponent(result.error)}`,
  );
}

// ---------------------------------------------------------------- showrooms

export async function saveStoreAction(formData: FormData): Promise<void> {
  const rawId = String(formData.get("id") ?? "");
  const id = rawId ? Number(rawId) : null;
  if (rawId && !Number.isInteger(id)) redirect("/admin/showrooms?error=" + encodeURIComponent("Unknown showroom."));

  const t = (name: string) => String(formData.get(name) ?? "").trim();
  const result = await saveStore(id, {
    slug: t("slug").toLowerCase(),
    name: t("name"),
    city: t("city"),
    address: t("address"),
    phone: t("phone"),
    whatsapp: t("whatsapp"),
    email: t("email"),
    hours: t("hours"),
    kind: t("kind"),
    sortOrder: Number(t("sortOrder")) || 0,
  });

  redirect(
    result.ok ? "/admin/showrooms?saved=1" : `/admin/showrooms?error=${encodeURIComponent(result.error)}`,
  );
}

export async function deleteStoreAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/admin/showrooms?error=" + encodeURIComponent("Unknown showroom."));
  const result = await deleteStore(id);
  redirect(result.ok ? "/admin/showrooms?saved=1" : `/admin/showrooms?error=${encodeURIComponent(result.error)}`);
}
