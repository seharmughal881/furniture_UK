"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type CategoryTile = { slug: string; name: string; nameAr: string; count: number; image: string | null; video: string | null };

/**
 * Category carousel: snap-scrolling cards with arrows, a progress bar, mouse drag on desktop
 * and native swipe on phones. A drag never counts as a click.
 * Each card has a short product video that plays only while it has attention — on hover with a
 * mouse, or while it is the card in the middle of the screen on touch phones — one at a time,
 * so the page never downloads a dozen videos at once.
 */
function play(v: HTMLVideoElement) {
  v.play()
    .then(() => v.classList.add("playing"))
    .catch(() => {});
}
function stop(v: HTMLVideoElement) {
  v.pause();
  v.classList.remove("playing");
}

export function CategoryCarousel({ tiles }: { tiles: CategoryTile[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 1);
      setAtStart(el.scrollLeft < 4);
      setAtEnd(el.scrollLeft > max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // touch screens: play the card nearest the middle while the carousel is on screen
  useEffect(() => {
    const el = rail.current;
    if (!el || window.matchMedia("(hover: hover)").matches) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    let onScreen = false;
    const centred = new Set<HTMLElement>();
    const sync = () =>
      el.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
        const card = v.closest<HTMLElement>(".cc-card")!;
        if (onScreen && centred.has(card)) play(v);
        else stop(v);
      });
    const middle = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? centred.add(e.target as HTMLElement) : centred.delete(e.target as HTMLElement)));
        sync();
      },
      { root: el, rootMargin: "0px -42% 0px -42%" },
    );
    const page = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    }, { threshold: 0.5 });
    el.querySelectorAll(".cc-card").forEach((c) => middle.observe(c));
    page.observe(el);
    return () => {
      middle.disconnect();
      page.disconnect();
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".cc-card");
    const w = card ? card.offsetWidth + 18 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * w * Math.max(1, Math.floor(el.clientWidth / w)), behavior: "smooth" });
  };

  return (
    <div className="cc">
      <div className="cc-controls">
        <button className="cc-arrow" aria-label="Previous categories" disabled={atStart} onClick={() => step(-1)}>
          ←
        </button>
        <button className="cc-arrow" aria-label="Next categories" disabled={atEnd} onClick={() => step(1)}>
          →
        </button>
      </div>
      <div
        ref={rail}
        className={`cc-rail ${atStart ? "" : "fade-l"} ${atEnd ? "" : "fade-r"}`}
        data-lenis-prevent-wheel
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !rail.current) return;
          drag.current = { down: true, x: e.clientX, left: rail.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d.down || !rail.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) {
            d.moved = true;
            rail.current.classList.add("dragging");
          }
          rail.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          drag.current.down = false;
          rail.current?.classList.remove("dragging");
        }}
        onPointerLeave={() => {
          drag.current.down = false;
          rail.current?.classList.remove("dragging");
        }}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
      >
        {tiles.map((t, i) => (
          <Link
            key={t.slug}
            href={`/shop?category=${t.slug}`}
            className="cc-card"
            draggable={false}
            style={{ "--i": i } as React.CSSProperties}
            onPointerEnter={(e) => {
              const v = e.currentTarget.querySelector("video");
              if (v && e.pointerType === "mouse") play(v);
            }}
            onPointerLeave={(e) => {
              const v = e.currentTarget.querySelector("video");
              if (v && e.pointerType === "mouse") stop(v);
            }}
          >
            <span className="cc-num" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="cc-photo">
              <span className="cc-glow" aria-hidden />
              {t.image && <img src={t.image} alt="" loading={i < 4 ? "eager" : "lazy"} draggable={false} />}
              {t.video && <video src={t.video} muted loop playsInline preload="none" aria-hidden tabIndex={-1} />}
            </div>
            <div className="cc-info">
              <div>
                <strong>{t.name}</strong>
                <bdi dir="rtl" lang="ar">
                  {t.nameAr}
                </bdi>
              </div>
              <span className="cc-count">{t.count}</span>
              <span className="cc-go" aria-hidden>
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="cc-progress" aria-hidden>
        <i style={{ transform: `scaleX(${Math.max(0.08, progress)})` }} />
      </div>
    </div>
  );
}
