"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#c8102e", "#7a0b0b", "#111111", "#ffffff", "#ff4d5a", "#d9d9d9", "#ff8fa0"];

/** A one-off confetti burst on a full-screen canvas (skipped for reduced motion). */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number; w: number; h: number; c: string; spin: number; round: boolean };
    const parts: P[] = [];
    const burst = (cx: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const sp = 7 + Math.random() * 9;
        parts.push({
          x: cx * canvas.width,
          y: canvas.height * 0.62,
          vx: Math.cos(a) * sp * dpr,
          vy: Math.sin(a) * sp * dpr,
          r: Math.random() * Math.PI,
          w: (6 + Math.random() * 6) * dpr,
          h: (8 + Math.random() * 8) * dpr,
          c: COLOURS[i % COLOURS.length],
          spin: (Math.random() - 0.5) * 0.3,
          round: Math.random() < 0.3,
        });
      }
    };
    burst(0.5, 160);
    const t2 = setTimeout(() => {
      burst(0.2, 70);
      burst(0.8, 70);
    }, 450);

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += 0.22 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
        ctx.restore();
      }
      if (t - start < 5000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t2);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
