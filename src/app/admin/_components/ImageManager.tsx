"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

/**
 * The product photo list.
 *
 * Files go from the browser straight to Vercel Blob -- see src/app/api/admin/upload/route.ts
 * for why they do not pass through our server. The chosen URLs are kept in React state and
 * mirrored into one hidden input as JSON, so the surrounding <form> posts them with
 * everything else and the server stays the only thing that validates them.
 *
 * Pasting a URL is kept alongside uploading because all 632 imported products already have
 * photos on Shopify's CDN, and because it is the only way to add an image before
 * BLOB_READ_WRITE_TOKEN is configured.
 */

const MAX_IMAGES = 12;

export function ImageManager({
  name,
  initial,
  uploadsEnabled,
  single = false,
}: {
  name: string;
  initial: string[];
  uploadsEnabled: boolean;
  /**
   * One picture rather than a gallery: used for single-image content fields such as the
   * sharing picture. The value is then posted as a plain string, not a JSON array, so the
   * field's schema stays a simple address.
   */
  single?: boolean;
}) {
  const [images, setImages] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const limit = single ? 1 : MAX_IMAGES;
  const room = limit - images.length;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const chosen = Array.from(files).slice(0, room);
    const added: string[] = [];

    for (const [i, file] of chosen.entries()) {
      setBusy(`Uploading ${i + 1} of ${chosen.length}…`);
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
        });
        added.push(blob.url);
      } catch (err) {
        // The route answers with a readable message for a rejected type, an oversized
        // file, a missing token or a spent quota; show that rather than a generic failure.
        setError(err instanceof Error ? err.message : "That file could not be uploaded.");
        break;
      }
    }

    setBusy(null);
    if (added.length) setImages((prev) => [...prev, ...added].slice(0, limit));
    if (fileInput.current) fileInput.current.value = "";
  }

  function addUrl() {
    const url = draft.trim();
    if (!url) return;
    if (!url.startsWith("https://") && !url.startsWith("/")) {
      setError("An image address must start with https:// or /");
      return;
    }
    if (images.includes(url)) {
      setError("That image is already on this product.");
      return;
    }
    setError(null);
    setImages((prev) => [...prev, url].slice(0, limit));
    setDraft("");
  }

  const move = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <div className="adm-images">
      <input type="hidden" name={name} value={single ? (images[0] ?? "") : JSON.stringify(images)} />

      {images.length === 0 ? (
        <p className="adm-empty">{single ? "No picture yet." : "No photos yet. The first one you add becomes the main photo."}</p>
      ) : (
        <ul className="adm-thumbs">
          {images.map((url, i) => (
            <li key={url}>
              {/* A plain <img>, like the whole storefront: these are arbitrary remote URLs
                  and next/image would need every host allow-listed up front. */}
              <img src={url} alt="" loading="lazy" />
              {i === 0 && !single && <span className="adm-thumb-main">Main photo</span>}
              <div className="adm-thumb-tools">
                {!single && (
                  <>
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier">
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i === images.length - 1}
                      aria-label="Move later"
                    >
                      →
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="adm-thumb-remove"
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  aria-label="Remove this photo"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <div className="adm-image-add">
          {uploadsEnabled && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                onChange={(e) => addFiles(e.target.files)}
                id={`${name}-file`}
                className="adm-file"
              />
              <label htmlFor={`${name}-file`} className="adm-btn">
                Upload photos
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
            placeholder="…or paste an image address"
            aria-label="Image address"
          />
          <button type="button" className="adm-btn" onClick={addUrl}>
            Add
          </button>
          {!single && <span className="adm-stat-note">{room} more allowed</span>}
        </div>
      )}

      {!uploadsEnabled && (
        <p className="adm-stat-note">
          Uploading from this computer is switched off until image storage is set up. You can still paste
          image addresses.
        </p>
      )}
      {busy && <p className="adm-stat-note">{busy}</p>}
      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
