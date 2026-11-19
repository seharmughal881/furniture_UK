"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAmbient3D } from "@/components/Canvas3D";
import type { HeroSofa } from "@/lib/catalog";
import { Color } from "@/lib/color";
import { formatPrice } from "@/lib/types";
import type { Material, Palette } from "@/lib/types";
import { daylightAt, formatHour } from "@/three/daylight";
import { A_END, B_END, clamp01, hourAt, smooth } from "./heroTiming";

/** three.js rides along with this chunk, so it is fetched only when the scene is wanted. */
const HeroStoryScene = dynamic(() => import("./HeroStoryScene"), { ssr: false });
// The story opens on the finished sofa: scrolling covers START..1 of the timeline (the wireframe
// build-up before START is skipped). Raise START to 0 to bring the build-up back.
const START: number = A_END;

/**
 * The narrowest viewport that gets the 3D story, in px. Must stay in step with the
 * `max-width: 720px` switch in globals.css that hides `.story` and shows
 * `.hero-mobile`; below it this component renders its copy but no WebGL.
 */
const DESKTOP = 721;

/**
 * The swatch closest to a real product's colour, so the hero opens in the shade the
 * sofa is actually sold in rather than whichever fabric happens to be first in the
 * table. Plain squared distance in RGB: the swatches are far enough apart that a
 * perceptual space would pick the same one, and this needs no colour library.
 */
function nearestMaterial(list: Material[], hex: string | undefined) {
  const want = /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex! : null;
  if (!want || !list.length) return list[0];
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(want);
  let best = list[0];
  let bestD = Infinity;
  for (const m of list) {
    if (!/^#[0-9a-f]{6}$/i.test(m.hex)) continue;
    const [mr, mg, mb] = rgb(m.hex);
    const d = (mr - r) ** 2 + (mg - g) ** 2 + (mb - b) ** 2;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}


/**
 * The scroll-driven 3D story. Shown from tablet width up; phones get HeroMobile
 * instead, so everything expensive in here is gated on `DESKTOP` below.
 */
export function HeroStory({ materials, sofa }: { materials: Material[]; sofa: HeroSofa | null }) {
  const fabrics = materials.filter((m) => m.role === "fabric");
  const woods = materials.filter((m) => m.role === "wood");
  const metals = materials.filter((m) => m.role === "metal");

  // opens in the real sofa's own colour; the visitor can still try the others
  const [fabric, setFabric] = useState(() => nearestMaterial(fabrics, sofa?.colour));
  const [wood, setWood] = useState(woods[0]);
  const palette: Palette = { fabric: fabric.hex, wood: wood.hex, metal: metals[0]?.hex ?? "#b9b8b4" };

  const section = useRef<HTMLElement>(null);
  const clock = useRef<HTMLDivElement>(null);
  const progress = useRef(START);
  const [chapter, setChapter] = useState(0);

  /*
   * Phones never render this story -- CSS hides `.story` below 721px -- but hiding it
   * is not the same as not running it. Left ungated, a phone would still mount a
   * second WebGL <View> into the shared canvas and drive a requestAnimationFrame
   * loop against a display:none element for the life of the page. So the viewport is
   * asked directly, at the same width CSS switches on.
   *
   * It starts false so the server's HTML and the first client render agree; the
   * canvas is client-only anyway, so there is nothing to hydrate into.
   */
  const [desktop, setDesktop] = useState(false);
  // three.js only after the page is idle, and never on a phone.
  const ready3D = useAmbient3D();
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP}px)`);
    const read = () => setDesktop(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const bp = new Color("#120d0f"); // warm near-black, matching the dark sections below
    const bone = new Color("#ffffff");
    const top = new Color();
    const bottom = new Color();
    const ink = new Color();
    let id = 0;
    let lastChapter = -1;
    let last = performance.now();
    // touch screens scroll natively (no smooth wheel), so the story eases after the thumb instead
    // of jumping with every flick; mouse and trackpad keep following the scroll exactly
    const touch = window.matchMedia("(pointer: coarse)").matches;

    const tick = (now: number) => {
      id = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const el = section.current;
      if (!el) return;
      const st = el;
      const rect = el.getBoundingClientRect();
      const target = START + (1 - START) * clamp01(-rect.top / (rect.height - window.innerHeight));
      const p = touch ? progress.current + (target - progress.current) * (1 - Math.exp(-dt * 7)) : target;
      progress.current = p;

      // Background: blueprint navy -> bone during assembly, then sky by time of day.
      const build = smooth(0.12, A_END, p);
      const d = daylightAt(hourAt(p));
      const sky = smooth(0.6, 0.66, p);
      top.copy(bp).lerp(bone, build).lerp(new Color(d.skyTop), sky);
      bottom.copy(bp).lerp(bone, build).lerp(new Color(d.skyBottom), sky);
      const night = smooth(0.4, 0.9, d.glow) * sky;
      ink.set("#ffffff").lerp(new Color("#111111"), build * (1 - night));
      st.style.setProperty("--sky-top", `#${top.getHexString()}`);
      st.style.setProperty("--sky-bottom", `#${bottom.getHexString()}`);
      st.style.setProperty("--stage-ink", `#${ink.getHexString()}`);
      st.style.setProperty("--grid-opacity", String(1 - build));
      const raw = (p - START) / (1 - START); // how far through the section the visitor has scrolled
      st.style.setProperty("--accent-live", night > 0.5 ? "#d9b77a" : "#c8102e"); // gold under lamplight
      st.style.setProperty("--clock-ink", night > 0.5 ? "#d9b77a" : "inherit");
      if (clock.current) clock.current.textContent = formatHour(hourAt(p));

      const c = raw < 0.07 ? 0 : p < B_END ? 1 : 2;
      if (c !== lastChapter) {
        lastChapter = c;
        setChapter(c);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [desktop]);

  return (
    <section ref={section} className="story" aria-label="Watch a Muscat Furniture sofa being built">
      <div className="stage-bg">
        <div className="stage-grid" />
      </div>
      <div className="stage">
        {desktop && ready3D && (
          <HeroStoryScene progress={progress} palette={palette} sofa={sofa} />
        )}

        {/*
          What is actually being built, named.

          This corner used to carry invented specs ("21 PARTS", a made-up W/D/H) and was
          switched off anyway, because START skips the wireframe chapter it belonged to.
          It now names the real best-selling sofa set with its real price, so the piece
          assembling on screen is one the visitor can click through and buy -- the whole
          point of the animation being on a shop's front page.

          It stays up for the whole story rather than only the first screen: the sofa is
          on screen in every chapter, so hiding its name after one scroll just loses the
          sale.
        */}
        {sofa && (
          <Link href={`/product/${sofa.slug}`} className="hero-piece">
            <small>Now building · Best seller</small>
            <b>{sofa.name}</b>
            <i>
              {formatPrice(sofa.priceCents)}
              {sofa.compareAtCents && sofa.compareAtCents > sofa.priceCents && (
                <s>{formatPrice(sofa.compareAtCents)}</s>
              )}
            </i>
            <u>See this sofa →</u>
          </Link>
        )}

        <div className="progress-rail above" aria-hidden>
          {["01 The sofa", "02 Material", "03 Daylight"].map((t, i) => (
            <span key={t} className={chapter === i ? "on" : ""}>
              {t}
            </span>
          ))}
        </div>

        <div className={`chapter chapter-a ${chapter === 0 ? "on" : ""}`}>
          <p className="hero-badge">
            <i aria-hidden /> Live 3D · Muscat Furniture
          </p>
          <h1 className="rise">
            {["Furniture", "that"].map((w, i) => (
              <span key={w} style={{ "--i": i } as React.CSSProperties}>
                {w}
              </span>
            ))}
            <em>
              {["builds", "itself"].map((w, i) => (
                <span key={w} style={{ "--i": i + 2 } as React.CSSProperties}>
                  {w}
                </span>
              ))}
            </em>
            {["in", "front", "of", "you."].map((w, i) => (
              <span key={w} style={{ "--i": i + 4 } as React.CSSProperties}>
                {w}
              </span>
            ))}
          </h1>
          <p>
            Oman&apos;s first furniture store you can explore in 3D. Scroll to try fabrics, see it from midday to
            lamplight, then plan your room before you order.
          </p>
          <div className="hero-ctas">
            <Link href="/shop" className="btn solid">
              Shop now
            </Link>
            <Link href="/planner" className="btn hero-ghost">
              <span className="long">Plan your room in 3D</span>
              <span className="short">Plan in 3D</span>
            </Link>
          </div>
          <ul className="hero-trust">
            <li>Cash on delivery</li>
            <li>Delivery in 4–6 days</li>
            <li>6 showrooms in Oman</li>
          </ul>
        </div>

        <div className={`chapter ${chapter === 1 ? "on" : ""}`}>
          <p className="label">02 — Material lab</p>
          <h2>
            Touch it <em>before</em> it exists.
          </h2>
          <p>Pick a fabric. Watch it weave across the frame.</p>
          <div className="swatch-row" role="group" aria-label="Fabric">
            {fabrics.map((m) => (
              <button
                key={m.slug}
                className="swatch"
                style={{ "--c": m.hex } as React.CSSProperties}
                aria-pressed={m.slug === fabric.slug}
                aria-label={m.name}
                onClick={() => setFabric(m)}
              />
            ))}
          </div>
          <div className="swatch-name">
            {fabric.name} — {fabric.note}
          </div>
          <div className="swatch-row" role="group" aria-label="Wood">
            {woods.map((m) => (
              <button
                key={m.slug}
                className="swatch sm"
                style={{ "--c": m.hex } as React.CSSProperties}
                aria-pressed={m.slug === wood.slug}
                aria-label={m.name}
                onClick={() => setWood(m)}
              />
            ))}
          </div>
          <div className="swatch-name">{wood.name}</div>
        </div>

        <div className={`chapter ${chapter === 2 ? "on" : ""}`}>
          <p className="label">03 — A day in the life</p>
          <div className="clock" ref={clock}>
            13:00
          </div>
          <h2 style={{ fontSize: "clamp(32px, 3.6vw, 56px)" }}>
            From midday sun to <em>lamplight.</em>
          </h2>
          <p>Keep scrolling to move the sun. See how your majlis really feels at night, before anything is delivered.</p>
          <Link href="/shop?category=lighting" className="hero-link">
            Explore lighting →
          </Link>
        </div>

        <div className="scroll-cue" style={{ opacity: chapter === 0 ? 1 : 0 }}>
          Scroll to explore <i />
        </div>
      </div>
    </section>
  );
}
