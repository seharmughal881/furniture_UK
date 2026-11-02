"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pointer-driven DOM effects: 3D tilt on cards, ripples on buttons and a scroll progress bar.
 * Scroll reveals are pure CSS (animation-timeline: view()), so nothing here touches markup
 * React is still hydrating. Skipped entirely for visitors who prefer reduced motion.
 */
export function MotionLayer() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (reduce) return;

    // --- 3D tilt toward the pointer
    let tilted: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(".photo-card, .room-tile, .store-card");
      if (tilted && tilted !== card) {
        tilted.style.removeProperty("--rx");
        tilted.style.removeProperty("--ry");
      }
      tilted = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      card.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
      card.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
    };

    // --- ripple on buttons
    const onDown = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".btn, .chip, .cart-btn, .swatch");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "ripple";
      const size = Math.max(r.width, r.height) * 2;
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      btn.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove());
    };

    // --- scroll progress
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = root.scrollHeight - innerHeight;
        bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? scrollY / max : 0})`);
      });
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <div ref={bar} className="scroll-progress" aria-hidden />;
}

/** Counts up from 0 when it scrolls into view. */
export function CountUp({ to, duration = 1400 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return <span ref={ref}>{value}</span>;
}

/** Endless scrolling strip of short messages. */
export function Marquee({ items }: { items: string[] }) {
  const row = items.map((t, i) => (
    <span key={i} className="marquee-item">
      {t}
      <i aria-hidden>✦</i>
    </span>
  ));
  return (
    <div className="marquee" aria-label={items.join(". ")}>
      <div className="marquee-track" aria-hidden>
        {row}
        {row}
      </div>
    </div>
  );
}
