"use client";

import { useState } from "react";
import { ShowroomReel, type ReelClip } from "./ShowroomReel";

/**
 * Top of a showroom page: the real shop from Google Street View, and our furniture videos,
 * as two tabs. Street View opens first wherever Google has it.
 *
 * Street View is embedded, never copied: Google's photos belong to whoever took them and its
 * terms forbid re-hosting them, so a "video made from Google photos" is not something we
 * may publish. The embed is the permitted way to show the real shopfront, and visitors can
 * turn around in it.
 */
export function ShowroomMedia({
  streetViewSrc,
  inside,
  place,
  clips,
  reelLabel,
}: {
  streetViewSrc: string | null;
  inside: boolean;
  place: string;
  clips: ReelClip[];
  reelLabel: string;
}) {
  const [tab, setTab] = useState<"street" | "reel">(streetViewSrc ? "street" : "reel");
  if (!streetViewSrc) return <ShowroomReel clips={clips} label={reelLabel} />;

  const streetLabel = inside ? "Walk inside the shop" : "Outside the shop";
  return (
    <div className="showroom-media">
      <div className="showroom-tabs" role="tablist" aria-label="Showroom views">
        <button type="button" role="tab" id="tab-street" aria-controls="panel-street" aria-selected={tab === "street"} onClick={() => setTab("street")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <circle cx="12" cy="5" r="2.2" />
            <path d="M9.5 21v-6l-1.5-1V9.5h8V14l-1.5 1v6M4 18c0 1.7 3.6 3 8 3s8-1.3 8-3" />
          </svg>
          {streetLabel}
        </button>
        <button type="button" role="tab" id="tab-reel" aria-controls="panel-reel" aria-selected={tab === "reel"} onClick={() => setTab("reel")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <rect x="3" y="5" width="13" height="14" rx="2" />
            <path d="m16 10 5-3v10l-5-3" />
          </svg>
          On display
        </button>
      </div>

      {tab === "street" ? (
        <div className="street-stage" role="tabpanel" id="panel-street" aria-labelledby="tab-street">
          <iframe
            title={`Google Street View: ${streetLabel.toLowerCase()} — ${place}`}
            src={streetViewSrc}
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <span className="reel-tag street-tag">
            <i aria-hidden />
            {inside ? "360° · drag to look around" : "Real view · drag to look around"}
          </span>
        </div>
      ) : (
        <div role="tabpanel" id="panel-reel" aria-labelledby="tab-reel">
          <ShowroomReel clips={clips} label={reelLabel} />
        </div>
      )}
    </div>
  );
}
