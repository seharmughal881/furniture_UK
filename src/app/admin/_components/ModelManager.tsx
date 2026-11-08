"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

/**
 * The product's 3D model, as a .glb.
 *
 * Same two ways in as a photo or a video: upload the file, or paste an address that is
 * already online. The chosen address is mirrored into one hidden input, so the
 * surrounding <form> posts it with everything else and the server stays the only thing
 * that validates it.
 *
 * One model per product: product_models has product_id as its primary key, and the
 * storefront shows a single "View in 3D" tab. A product with nothing here falls back to
 * the generic shape for its furniture type.
 */
export function ModelManager({
  name,
  initial,
  uploadsEnabled,
}: {
  name: string;
  initial: string;
  uploadsEnabled: boolean;
}) {
  const [url, setUrl] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);

    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("That is not a .glb file. Export the model as binary glTF and try again.");
      return;
    }

    setBusy(true);
    try {
      /*
       * Re-wrap the file with an explicit type.
       *
       * Most systems have no media type registered for .glb, so `file.type` arrives empty
       * and Blob rejects the upload against its allow-list. The bytes are untouched; only
       * the label is supplied, and the server's own allow-list still decides.
       */
      const typed = new File([file], file.name, { type: "model/gltf-binary" });
      const blob = await upload(typed.name, typed, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        // Tells the route to issue a token for a 3D model rather than a photo.
        clientPayload: "model",
      });
      setUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be uploaded.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addUrl() {
    const next = draft.trim();
    if (!next) return;
    if (!next.startsWith("https://") && !next.startsWith("/")) {
      setError("A model address must start with https:// or /");
      return;
    }
    setError(null);
    setUrl(next);
    setDraft("");
  }

  return (
    <div className="adm-images">
      {/*
        Whatever is in the box wins, even if "Add" was never pressed.
        Pasting an address and going straight to "Save changes" is the obvious thing to
        do, and with the hidden field tied to `url` alone that silently saved nothing --
        the page came back looking unchanged with no error to explain it. An address
        typed but not added is still what the owner meant; if it is malformed the server
        says so, which is far better than discarding it without a word.
      */}
      <input type="hidden" name={name} value={draft.trim() || url} />

      {url ? (
        <div className="adm-model-current">
          <p className="adm-stat-note">
            3D model set · <code>{url.length > 70 ? `${url.slice(0, 70)}…` : url}</code>
          </p>
          <button type="button" className="adm-btn" onClick={() => setUrl("")}>
            Remove 3D model
          </button>
        </div>
      ) : (
        <p className="adm-empty">
          No 3D model. Without one the product shows a generic shape for its furniture type in
          &ldquo;View in 3D&rdquo;.
        </p>
      )}

      <div className="adm-image-add">
        {uploadsEnabled && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(e) => addFile(e.target.files)}
              id={`${name}-file`}
              className="adm-file"
            />
            <label htmlFor={`${name}-file`} className="adm-btn">
              {url ? "Replace 3D model" : "Upload a .glb"}
            </label>
          </>
        )}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Otherwise Enter in this box would submit the whole product form.
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="…or paste a model address"
          aria-label="3D model address"
        />
        <button type="button" className="adm-btn" onClick={addUrl}>
          Add
        </button>
      </div>

      {!uploadsEnabled && (
        <p className="adm-stat-note">
          Uploading from this computer is switched off until file storage is set up. You can still
          paste an address.
        </p>
      )}
      {busy && <p className="adm-stat-note">Uploading… a 3D model is large, so this can take a moment.</p>}
      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
