"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  /** where tapping the photo goes -- the product itself */
  href: string;
  image: string;
  /** the small gold line above the name, e.g. "Sofas" */
  label: string;
  name: string;
  price: string;
};

/** How long each photo is held before the carousel moves itself on. */
const DWELL = 5000;

/**
 * The homepage hero on phones: real photos in a swipeable carousel.
 *
 * The desktop hero (HeroStory) is a scroll-driven 3D film -- five camera moves, a
 * sofa that assembles itself, fabric swatches and a day-to-night sky. That design
 * needs a wide frame, a pointer and several screens of scroll, none of which a
 * phone has: the headline there even promises an animation ("furniture that builds
 * itself in front of you") that a phone visitor mostly scrolls past. So phones get
 * this instead -- no WebGL, no scroll hijacking, just photographs of what is for
 * sale, each one a link to the product.
 *
 * Both heroes are in the markup and CSS decides which one is shown (see
 * `.hero-mobile` / `.story` in globals.css), so there is no first-paint flash and
 * no guess about the viewport during hydration. HeroStory separately declines to
 * mount its WebGL view below the same width, so the 3D scene never runs here.
 */
export function HeroMobile({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  /** A finger on the track pauses the auto-advance; nothing is worse than a carousel
      that moves out from under the thumb mid-swipe. */
  const held = useRef(false);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    // A wrap from the last photo back to the first would otherwise sweep across
    // every slide in between, so that one step is taken instantly.
    el.scrollTo({ left: i * el.clientWidth, behavior: i === 0 && at > 1 ? "auto" : "smooth" });
  }, [at]);

  /*
   * Which photo is showing is read back from the scroll position rather than held
   * as the source of truth, so a swipe, a dot tap and the timer all agree.
   */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = track.current;
      // A hidden tab would otherwise queue up a burst of jumps on return, and a
      // hidden element (this one, on a wide screen) has no width to scroll.
      if (!el || !el.clientWidth || held.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: next === 0 ? "auto" : "smooth" });
    }, DWELL);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section className="hero-mobile" aria-label="Muscat Furniture">
      <div
        className="mhero-track"
        ref={track}
        // the page runs Lenis smooth scrolling; this track scrolls itself
        data-lenis-prevent-wheel
        onPointerDown={() => (held.current = true)}
        onPointerUp={() => (held.current = false)}
        onPointerCancel={() => (held.current = false)}
        onPointerLeave={() => (held.current = false)}
      >
        {slides.map((s) => (
          <Link key={s.href} href={s.href} className="mhero-slide">
            {/*
              Lazy on every slide, including the first.

              On a wide screen this whole section is display:none, and an eager or
              high-priority image is fetched anyway -- so marking the first photo as the
              LCP candidate would have every desktop visitor download a hero they never
              see, competing with the three.js bundle the hero they *do* see needs. A
              lazy image that is already in the viewport, which this one is on a phone,
              still gets fetched in the browser's first pass; a hidden one is skipped
              entirely. Mobile loses a few milliseconds, desktop loses nothing.
            */}
            <img src={s.image} alt={s.name} loading="lazy" decoding="async" />
            <span className="mhero-tag">
              <small>{s.label}</small>
              <b>{s.name}</b>
              <i>{s.price}</i>
            </span>
          </Link>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mhero-dots">
          {slides.map((s, i) => (
            <button
              key={s.href}
              type="button"
              className={i === at ? "on" : ""}
              aria-label={`Photo ${i + 1} of ${slides.length}: ${s.name}`}
              aria-current={i === at}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}

      <div className="mhero-copy">
        <p className="mhero-badge">
          <i aria-hidden /> Muscat Furniture · Oman
        </p>
        <h1>
          Furniture for every room, <em>delivered across Oman.</em>
        </h1>
        <p className="mhero-sub">
          Sofa sets made in Oman, bedrooms, dining and lighting — with prices in rials and cash on delivery.
        </p>
        <div className="mhero-ctas">
          <Link href="/shop" className="btn solid">
            Shop now
          </Link>
          <Link href="/planner" className="btn mhero-ghost">
            Plan in 3D
          </Link>
        </div>
        <ul className="mhero-trust">
          <li>Cash on delivery</li>
          <li>Delivery in 4–6 days</li>
          <li>6 showrooms in Oman</li>
        </ul>
      </div>
    </section>
  );
}
