"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CategoryVideo } from "@/lib/category-videos";

/** 720p on wide screens, 480p on phones; none at all on data-saver (the still image is shown instead). */
function pickQuality(): "sd" | "hd" | null {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return null;
  return window.matchMedia("(min-width: 1000px)").matches ? "hd" : "sd";
}

const noSubscribe = () => () => {};

// The video (a few MB) waits until the page has finished loading, so it never competes
// with the product photos and code the shopper is waiting for. Until then: the still.
const onPageLoad = (done: () => void) => {
  window.addEventListener("load", done);
  return () => window.removeEventListener("load", done);
};
const pageLoaded = () => document.readyState === "complete";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The category's videos as tall "reel" cards beside the shop heading: the front card plays
 * (muted, inline) and hands over to the next when it ends; the next one waits, fanned out behind.
 * Each card links to the product in the video. Pauses while scrolled out of view.
 */
export function CategoryReel({ videos }: { videos: CategoryVideo[] }) {
  const [i, setI] = useState(0);
  // browser-only settings; the server (and first paint) shows the still image
  const loaded = useSyncExternalStore(onPageLoad, pageLoaded, () => false);
  const quality = useSyncExternalStore(noSubscribe, pickQuality, () => undefined);
  const videoQuality = loaded ? quality : null;
  const reduced = useSyncExternalStore(noSubscribe, reducedMotion, () => true);
  const [userPaused, setPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduced;
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const v = video.current;
      if (!v || paused) return;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [paused, i, videoQuality]);

  if (!videos.length) return null;
  const cur = videos[i % videos.length];
  const next = videos[(i + 1) % videos.length];

  return (
    <div className="shop-reel" ref={box}>
      {videos.length > 1 && (
        <div className="reel-card back" aria-hidden>
          <img src={next.poster} alt="" />
        </div>
      )}
      <div className="reel-card front" key={cur.slug}>
        {videoQuality ? (
          <video
            ref={video}
            src={cur[videoQuality]}
            poster={cur.poster}
            muted
            playsInline
            autoPlay={!paused}
            preload="auto"
            loop={videos.length === 1}
            onEnded={() => setI((n) => n + 1)}
            aria-label={`Video: ${cur.name}`}
          />
        ) : (
          <img src={cur.poster} alt={cur.name} />
        )}
        {videoQuality && (
          <button
            className="reel-toggle"
            aria-label={paused ? "Play video" : "Pause video"}
            onClick={() => {
              const v = video.current;
              if (!v) return;
              if (v.paused) {
                v.play().catch(() => {});
                setPaused(false);
              } else {
                v.pause();
                setPaused(true);
              }
            }}
          >
            {paused ? "▶" : "❚❚"}
          </button>
        )}
        <Link href={`/product/${cur.slug}`} className="reel-caption">
          <span>{cur.name}</span> →
        </Link>
      </div>
      {videos.length > 1 && (
        <div className="reel-dots" role="group" aria-label="Videos">
          {videos.map((v, n) => (
            <button key={v.slug} aria-label={`Video ${n + 1}: ${v.name}`} aria-pressed={n === i % videos.length} onClick={() => setI(n)} />
          ))}
        </div>
      )}
    </div>
  );
}
