import { z } from "zod";

/**
 * The little field vocabulary the admin content forms are generated from.
 *
 * Deliberately small. Every editable block in blocks.ts describes itself with these, and
 * one generic form component renders them, so adding a new editable section is a matter
 * of describing it rather than writing another bespoke form.
 *
 * No "server-only" here: the admin form components are client components and import the
 * same definitions the server validates with, which is the point -- the labels the owner
 * reads and the rules the server enforces cannot drift apart.
 */

export type Field =
  | { kind: "text"; name: string; label: string; help?: string; max?: number; placeholder?: string }
  | { kind: "textarea"; name: string; label: string; help?: string; max?: number; rows?: number }
  | { kind: "boolean"; name: string; label: string; help?: string }
  | { kind: "image"; name: string; label: string; help?: string }
  | { kind: "number"; name: string; label: string; help?: string; min?: number; max?: number }
  | { kind: "select"; name: string; label: string; help?: string; options: { value: string; label: string }[] }
  | { kind: "list"; name: string; label: string; help?: string; max: number; itemLabel: string; fields: Field[] };

/** Arabic text, phone numbers and prices all live in plain text fields; max keeps them sane. */
export const text = (max = 300) => z.string().trim().max(max);

/** An image or link address: https, a site-relative path, or blank. */
export const link = z
  .string()
  .trim()
  .max(600)
  .refine(
    (s) => s === "" || s.startsWith("https://") || s.startsWith("/") || s.startsWith("#") || s.startsWith("mailto:") || s.startsWith("tel:"),
    "Must be an https:// address, or start with / or #",
  );

/**
 * Walks a field list and pulls each value out of posted FormData.
 *
 * Scalars arrive as ordinary named inputs. A list arrives as one hidden input holding
 * JSON, which is how ImageManager and VariantEditor already work in this project -- it
 * keeps add/remove/reorder entirely in the browser and means the server never has to
 * reconstruct an array from indexed field names.
 */
export function readFields(fields: Field[], formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === "list") {
      try {
        const parsed = JSON.parse(String(formData.get(field.name) ?? "[]"));
        out[field.name] = Array.isArray(parsed) ? parsed : [];
      } catch {
        out[field.name] = [];
      }
      continue;
    }
    if (field.kind === "boolean") {
      const v = formData.get(field.name);
      out[field.name] = v === "on" || v === "true";
      continue;
    }
    if (field.kind === "number") {
      const raw = String(formData.get(field.name) ?? "").trim();
      out[field.name] = raw === "" ? null : Number(raw);
      continue;
    }
    out[field.name] = String(formData.get(field.name) ?? "");
  }
  return out;
}
