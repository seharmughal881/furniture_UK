"use client";

import { useRef, useState } from "react";

export type ReelClip = { src: string; poster: string; title: string };

/**
 * The showroom's video. Muted autoplay on a loop, as browsers only allow muted autoplay,
 * with a pause control (WCAG 2.2.2: moving content longer than five seconds must be
 * pausable) and thumbnails to switch clips.
 */
export function ShowroomReel({ clips, label }: { clips: ReelClip[]; label: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clip = clips[active];
  if (!clip) return null;

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div className="reel">
      <div className="reel-stage" style={{ "--poster": `url("${clip.poster}")` } as React.CSSProperties}>
        <video
          ref={video}
          key={clip.src}
          src={clip.src}
          poster={clip.poster}
          autoPlay={!paused}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={clip.title}
        />
        <span className="reel-tag">
          <i aria-hidden />
          {label}
        </span>
        <button type="button" className="reel-toggle" onClick={toggle} aria-label={paused ? "Play video" : "Pause video"}>
          {paused ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className="reel-title">{clip.title}</span>
      </div>
      {clips.length > 1 && (
        <div className="reel-thumbs" role="group" aria-label="Choose a video">
          {clips.map((c, i) => (
            <button
              key={c.src}
              type="button"
              className="reel-thumb"
              aria-pressed={i === active}
              aria-label={`Play: ${c.title}`}
              onClick={() => {
                setActive(i);
                setPaused(false);
              }}
            >
              <img src={c.poster} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
