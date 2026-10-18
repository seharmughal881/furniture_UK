"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Material, Palette } from "@/lib/types";
import { daylightAt, formatHour } from "@/three/daylight";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Scroll progress (0..1) -> chapter boundaries
const A_END = 0.3; // assembly
const B_END = 0.56; // material lab
const hourAt = (p: number) => 13 + 9 * smooth(0.62, 0.97, p);

type Shot = { p: number; pos: [number, number, number]; target: [number, number, number] };
const SHOTS: Shot[] = [
  { p: 0.0, pos: [4.4, 3.1, 5.8], target: [0.4, 0.7, 0] },
  { p: 0.27, pos: [2.9, 1.45, 3.7], target: [-0.1, 0.45, 0] },
  { p: 0.4, pos: [2.5, 1.25, 3.3], target: [-0.85, 0.45, 0] },
  { p: 0.54, pos: [1.5, 1.05, 3.5], target: [-1.05, 0.48, 0.1] },
  { p: 0.7, pos: [1.2, 2.7, 6.6], target: [-0.7, 0.55, 0] },
  { p: 1.0, pos: [-3.4, 2.1, 5.6], target: [-0.9, 0.6, 0] },
];

function shotAt(p: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  let i = 0;
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1].p) i++;
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const t = smooth(a.p, b.p, p);
  outPos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
  outTarget.set(...a.target).lerp(new THREE.Vector3(...b.target), t);
}

function CameraRig({ progress }: { progress: React.RefObject<number> }) {
  const { camera, pointer, size } = useThree();
  const pos = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame((_, dt) => {
    shotAt(progress.current, pos.current, target.current);
    // phones: pull back so the sofa fits the narrow frame
    const aspect = size.width / size.height;
    if (aspect < 1) {
      pos.current.sub(target.current).multiplyScalar(1 + (1 - aspect) * 1.3).add(target.current);
      target.current.x = target.current.x * 0.2;
    }
    pos.current.x += pointer.x * 0.25;
    pos.current.y += pointer.y * 0.12;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(pos.current, k);
    look.current.lerp(target.current, k);
    camera.lookAt(look.current);
  });
  return null;
}

const EXTRAS = [
  { kind: "armchair", pos: [-2.05, 0, 0.75], rot: 0.75 },
  { kind: "coffeeTable", pos: [-0.1, 0, 1.3], rot: 0 },
  { kind: "floorLamp", pos: [1.45, 0, -0.55], rot: 0 },
  { kind: "sideTable", pos: [-1.4, 0, -0.35], rot: 0 },
  { kind: "bookshelf", pos: [2.6, 0, -1.0], rot: -0.35 },
] as const;

function HeroScene({ progress, palette }: { progress: React.RefObject<number>; palette: Palette }) {
  const hour = () => hourAt(progress.current);
  const glow = () => daylightAt(hour()).glow;
  return (
    <>
      <PerspectiveCamera makeDefault fov={34} position={[4.4, 3.1, 5.8]} near={0.1} far={60} />
      <CameraRig progress={progress} />
      <SceneLights hour={hour} shadowSize={5} />
      <ShadowFloor />
      <Furniture kind="sofa" palette={palette} spread={1.5} assembly={() => smooth(0.015, A_END, progress.current)} />
      {EXTRAS.map((e, i) => (
        <Furniture
          key={e.kind}
          kind={e.kind}
          palette={palette}
          position={e.pos as unknown as [number, number, number]}
          rotation-y={e.rot}
          glow={glow}
          hideWhenUnbuilt
          assembly={() => smooth(B_END + 0.01 + i * 0.025, B_END + 0.13 + i * 0.025, progress.current)}
        />
      ))}
    </>
  );
}

export function HeroStory({ materials }: { materials: Material[] }) {
  const fabrics = materials.filter((m) => m.role === "fabric");
  const woods = materials.filter((m) => m.role === "wood");
  const metals = materials.filter((m) => m.role === "metal");

  const [fabric, setFabric] = useState(fabrics[0]);
  const [wood, setWood] = useState(woods[0]);
  const palette: Palette = { fabric: fabric.hex, wood: wood.hex, metal: metals[0]?.hex ?? "#b9b8b4" };

  const section = useRef<HTMLElement>(null);
  const clock = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const bp = new THREE.Color("#0d1726");
    const bone = new THREE.Color("#ece6dc");
    const top = new THREE.Color();
    const bottom = new THREE.Color();
    const ink = new THREE.Color();
    let id = 0;
    let lastChapter = -1;

    const tick = () => {
      id = requestAnimationFrame(tick);
      const el = section.current;
      if (!el) return;
      const st = el;
      const rect = el.getBoundingClientRect();
      const p = clamp01(-rect.top / (rect.height - window.innerHeight));
      progress.current = p;

      // Background: blueprint navy -> bone during assembly, then sky by time of day.
      const build = smooth(0.12, A_END, p);
      const d = daylightAt(hourAt(p));
      const sky = smooth(0.6, 0.66, p);
      top.copy(bp).lerp(bone, build).lerp(new THREE.Color(d.skyTop), sky);
      bottom.copy(bp).lerp(bone, build).lerp(new THREE.Color(d.skyBottom), sky);
      const night = smooth(0.4, 0.9, d.glow) * sky;
      ink.set("#f4f0e8").lerp(new THREE.Color("#1c1915"), build * (1 - night));
      st.style.setProperty("--sky-top", `#${top.getHexString()}`);
      st.style.setProperty("--sky-bottom", `#${bottom.getHexString()}`);
      st.style.setProperty("--stage-ink", `#${ink.getHexString()}`);
      st.style.setProperty("--grid-opacity", String(1 - build));
      st.style.setProperty("--accent-live", night > 0.5 ? "#ffb46b" : "#b4532a");
      if (clock.current) clock.current.textContent = formatHour(hourAt(p));

      const c = p < A_END - 0.04 ? 0 : p < B_END ? 1 : 2;
      if (c !== lastChapter) {
        lastChapter = c;
        setChapter(c);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section ref={section} className="story" aria-label="Watch the Loma sofa being built">
      <div className="stage-bg">
        <div className="stage-grid" />
      </div>
      <div className="stage">
        <View className="stage-view">
          <HeroScene progress={progress} palette={palette} />
        </View>

        <div className="blueprint-spec" style={{ opacity: chapter === 0 ? 1 : 0 }} aria-hidden>
          LOMA / 3-SEAT SOFA
          <br />
          W 2100 · D 900 · H 820 mm
          <br />
          21 PARTS · 1 MAKER · 64 HRS
        </div>

        <div className="progress-rail above" aria-hidden>
          {["01 Assembly", "02 Material", "03 Daylight"].map((t, i) => (
            <span key={t} className={chapter === i ? "on" : ""}>
              {t}
            </span>
          ))}
        </div>

        <div className={`chapter chapter-a ${chapter === 0 ? "on" : ""}`}>
          <p className="label">01 — Assembly</p>
          <h1>
            Furniture that <em>builds itself</em> in front of you.
          </h1>
          <p>
            Every Atelier piece is drawn, joined and finished by one maker. Scroll, and watch the Loma sofa come
            together part by part, exactly as it is made.
          </p>
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
          <p>Keep scrolling to move the sun. See how your room really feels at 10 pm, before anything ships.</p>
        </div>

        <div className="scroll-cue" style={{ opacity: chapter === 0 ? 1 : 0 }}>
          Scroll to build <i />
        </div>
      </div>
    </section>
  );
}
