"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

/**
 * The product's video.
 *
 * Two ways in, the same as a photo: upload the file, or paste an address that is already
 * online. The chosen address is mirrored into one hidden input, so the surrounding <form>
 * posts it with everything else and the server stays the only thing that validates it.
 *
 * One video per product, deliberately: the storefront shows a single "Video" tab, and a
 * product with nothing here shows no tab at all.
 */
export function VideoManager({
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
  // A pasted address can be dead or blocked to other sites; without this the owner just
  // sees a black rectangle and no reason why.
  const [failed, setFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        // Tells the route to issue a token for a video rather than a photo.
        clientPayload: "video",
      });
      setUrl(blob.url);
      setFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That video could not be uploaded.");
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function addUrl() {
    const v = draft.trim();
    if (!v) return;
    if (!v.startsWith("https://") && !v.startsWith("/")) {
      setError("A video address must start with https:// or /");
      return;
    }
    setError(null);
    setFailed(false);
    setUrl(v);
    setDraft("");
  }

  return (
    <div className="adm-images">
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className="adm-video">
          <video
            src={url}
            controls
            preload="metadata"
            onError={() => setFailed(true)}
            onLoadedMetadata={() => setFailed(false)}
          />
          {failed && (
            <span className="adm-thumb-bad" title={url}>
              Will not play
            </span>
          )}
          <div className="adm-thumb-tools">
            <button
              type="button"
              className="adm-thumb-remove"
              onClick={() => {
                setUrl("");
                setFailed(false);
              }}
            >
              Remove video
            </button>
          </div>
        </div>
      ) : (
        <p className="adm-empty">No video yet. The product page shows a Video tab only when there is one here.</p>
      )}

      {!url && (
        <div className="adm-image-add">
          {uploadsEnabled && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => addFile(e.target.files)}
                id={`${name}-file`}
                className="adm-file"
              />
              <label htmlFor={`${name}-file`} className="adm-btn">
                Upload video
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
            placeholder="…or paste a video address"
            aria-label="Video address"
          />
          <button type="button" className="adm-btn" onClick={addUrl}>
            Add
          </button>
          <span className="adm-stat-note">MP4 or WebM, up to 64MB</span>
        </div>
      )}

      {!uploadsEnabled && (
        <p className="adm-stat-note">
          Uploading from this computer is switched off until storage is set up. You can still paste a video
          address.
        </p>
      )}
      {busy && <p className="adm-stat-note">Uploading… large videos take a moment.</p>}
      {error && (
        <p className="adm-notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
