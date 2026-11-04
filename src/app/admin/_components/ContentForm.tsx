"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveContentAction, type ContentSaveState } from "../actions";
import { ImageManager } from "./ImageManager";
import type { Field } from "@/lib/content/fields";

/**
 * Renders the form for any content block from its field list, so a new editable section
 * only has to be *described* in blocks.ts rather than given its own bespoke form.
 *
 * List fields are managed entirely in the browser and posted as one hidden JSON input —
 * the pattern ImageManager and VariantEditor already use in this project. It keeps
 * add/remove/reorder instant and means the server never reconstructs an array out of
 * indexed field names.
 */

type Value = Record<string, unknown>;

function Scalar({
  field,
  value,
  error,
  uploadsEnabled,
}: {
  field: Field;
  value: unknown;
  error?: string[];
  uploadsEnabled: boolean;
}) {
  // Lists have their own editor below; this component only ever renders scalars. The
  // guard is what narrows `field` for the branches further down.
  if (field.kind === "list") return null;

  const invalid = error?.length ? "invalid" : "";
  const help = field.help ? <small className="adm-stat-note">{field.help}</small> : null;
  const message = error?.length ? <em className="adm-err">{error[0]}</em> : null;

  if (field.kind === "boolean") {
    return (
      <div className="adm-field">
        <label className="adm-check">
          <input type="checkbox" name={field.name} defaultChecked={Boolean(value)} />
          {field.label}
        </label>
        {help}
        {message}
      </div>
    );
  }

  if (field.kind === "image") {
    // One image, reusing the photo manager so uploading works the same way everywhere.
    return (
      <div className="adm-field">
        <span>{field.label}</span>
        <ImageManager
          name={field.name}
          initial={typeof value === "string" && value ? [value] : []}
          uploadsEnabled={uploadsEnabled}
          single
        />
        {help}
        {message}
      </div>
    );
  }

  return (
    <label className={`adm-field ${invalid}`}>
      <span>{field.label}</span>
      {field.kind === "textarea" ? (
        <textarea name={field.name} defaultValue={String(value ?? "")} rows={field.rows ?? 3} maxLength={field.max} />
      ) : field.kind === "select" ? (
        <select name={field.name} defaultValue={String(value ?? field.options[0]?.value ?? "")}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          name={field.name}
          defaultValue={value === null || value === undefined ? "" : String(value)}
          inputMode="numeric"
        />
      ) : (
        <input
          name={field.name}
          defaultValue={String(value ?? "")}
          maxLength={field.max}
          placeholder={field.placeholder}
        />
      )}
      {help}
      {message}
    </label>
  );
}

/** Rows of sub-fields, held in state and posted as one JSON input. */
function ListEditor({
  field,
  initial,
  error,
}: {
  field: Extract<Field, { kind: "list" }>;
  initial: Value[];
  error?: string[];
}) {
  const [rows, setRows] = useState<Value[]>(initial);

  const blank = (): Value =>
    Object.fromEntries(
      field.fields.map((f) => [
        f.name,
        f.kind === "boolean" ? false : f.kind === "number" ? 0 : f.kind === "select" ? f.options[0]?.value ?? "" : "",
      ]),
    );

  const patch = (i: number, name: string, v: unknown) =>
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, [name]: v } : r)));

  const move = (from: number, to: number) =>
    setRows((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <div className="adm-field">
      <span>{field.label}</span>
      {field.help && <small className="adm-stat-note">{field.help}</small>}
      <input type="hidden" name={field.name} value={JSON.stringify(rows)} />
      {error?.length ? <em className="adm-err">{error.join(" · ")}</em> : null}

      <ol className="adm-list-rows">
        {rows.map((row, i) => (
          <li key={i}>
            <div className="adm-list-head">
              <strong>
                {field.itemLabel} {i + 1}
              </strong>
              <div className="adm-list-tools">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="Move down">
                  ↓
                </button>
                <button
                  type="button"
                  className="adm-thumb-remove"
                  onClick={() => setRows((prev) => prev.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="adm-field-grid">
              {/* A list's own fields are plain scalars: a nested list or a per-row
                  uploader is not something any block needs, and allowing them would make
                  this editor recursive for no gain. */}
              {field.fields
                .filter((sub) => sub.kind !== "list" && sub.kind !== "image")
                .map((sub) =>
                sub.kind === "boolean" ? (
                  <div className="adm-field" key={sub.name}>
                    <label className="adm-check">
                      <input
                        type="checkbox"
                        checked={Boolean(row[sub.name])}
                        onChange={(e) => patch(i, sub.name, e.target.checked)}
                      />
                      {sub.label}
                    </label>
                  </div>
                ) : (
                  <label className="adm-field" key={sub.name}>
                    <span>{sub.label}</span>
                    {sub.kind === "select" ? (
                      <select value={String(row[sub.name] ?? "")} onChange={(e) => patch(i, sub.name, e.target.value)}>
                        {sub.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : sub.kind === "textarea" ? (
                      <textarea
                        value={String(row[sub.name] ?? "")}
                        rows={sub.rows ?? 2}
                        maxLength={sub.max}
                        onChange={(e) => patch(i, sub.name, e.target.value)}
                      />
                    ) : sub.kind === "number" ? (
                      <input
                        value={String(row[sub.name] ?? "")}
                        inputMode="numeric"
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          patch(i, sub.name, e.target.value === "" ? 0 : Number.isFinite(n) ? n : 0);
                        }}
                      />
                    ) : (
                      <input
                        value={String(row[sub.name] ?? "")}
                        maxLength={sub.max}
                        onChange={(e) => patch(i, sub.name, e.target.value)}
                      />
                    )}
                    {sub.help && <small className="adm-stat-note">{sub.help}</small>}
                  </label>
                ),
              )}
            </div>
          </li>
        ))}
      </ol>

      {rows.length < field.max && (
        <button type="button" className="adm-btn" onClick={() => setRows((prev) => [...prev, blank()])}>
          Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <div className="adm-actions adm-save-bar">
      <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save and publish"}
      </button>
      <Link href="/admin/content" className="adm-btn adm-btn-quiet">
        Back
      </Link>
    </div>
  );
}

export function ContentForm({
  blockKey,
  fields,
  value,
  uploadsEnabled,
}: {
  blockKey: string;
  fields: Field[];
  value: Value;
  uploadsEnabled: boolean;
}) {
  const [state, formAction] = useActionState<ContentSaveState, FormData>(saveContentAction, {});

  return (
    <form action={formAction} className="adm-form">
      <input type="hidden" name="key" value={blockKey} />

      {state.error && (
        <p className="adm-notice" role="alert">
          {state.error}
        </p>
      )}

      <section className="adm-card adm-pad">
        <div className="adm-field-grid">
          {fields
            .filter((f) => f.kind !== "list")
            .map((f) => (
              <Scalar
                key={f.name}
                field={f}
                value={value[f.name]}
                error={state.fieldErrors?.[f.name]}
                uploadsEnabled={uploadsEnabled}
              />
            ))}
        </div>
      </section>

      {fields
        .filter((f): f is Extract<Field, { kind: "list" }> => f.kind === "list")
        .map((f) => (
          <section className="adm-card adm-pad" key={f.name}>
            <ListEditor
              field={f}
              initial={Array.isArray(value[f.name]) ? (value[f.name] as Value[]) : []}
              error={state.fieldErrors?.[f.name]}
            />
          </section>
        ))}

      <SaveBar />
    </form>
  );
}
