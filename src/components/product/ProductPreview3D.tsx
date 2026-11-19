"use client";

import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Palette } from "@/lib/types";
import { AiModel, useAiModel } from "@/three/AiModel";
import { daylightAt } from "@/three/daylight";
import { frameFor } from "@/three/framing";
import { Furniture } from "@/three/FurniturePiece";
import { FOOTPRINT, HEIGHT, KIND_LABEL, piecesOf, type FurnitureKind } from "@/three/furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

/**
 * The product page's 3D viewer, in its own module.
 *
 * ProductExperience used to import three.js, drei and the furniture geometry at the top of
 * the file, which put ~891 KB of 3D engine into every product page's bundle whether or not
 * the customer ever pressed "View in 3D". Everything that touches three lives here instead,
 * and the page pulls this chunk in with next/dynamic when the 3D tab is chosen.
 */
type Preset = "angle" | "front" | "back" | "side" | "top";

/** Glides the camera to a preset position, then hands control back to OrbitControls. */
function CameraDirector({
  goal,
  controls,
}: {
  goal: React.RefObject<THREE.Vector3 | null>;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    camera.position.lerp(g, 1 - Math.exp(-dt * 5));
    controls.current?.update();
    if (camera.position.distanceTo(g) < 0.01) goal.current = null;
  });
  return null;
}

/**
 * One thumbnail in the piece rail: the same drawn furniture, small and still.
 *
 * It is a real 3D view rather than a picture of one, which costs nothing extra here --
 * every view on the site is scissored into the one shared canvas (see CanvasRoot), so a
 * thumbnail is a viewport, not a second WebGL context. It also means the thumbnail can
 * never drift out of step with the stage: both draw the same geometry in the same
 * fabric and wood the customer has chosen.
 *
 * No controls and no auto-rotate: these are a way of choosing a piece, and a row of
 * independently spinning thumbnails would pull attention off the stage.
 */
function PieceThumb({ kind, palette }: { kind: FurnitureKind; palette: Palette }) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const frame = frameFor(kind, 1.35);
  return (
    <span className="piece-thumb-view" ref={setEl}>
      {el && (
        <View style={{ position: "absolute", inset: 0 }} track={{ current: el } as React.RefObject<HTMLElement>}>
          <PerspectiveCamera makeDefault fov={32} position={frame.position} />
          <SceneLights hour={() => 15} shadowSize={2.5} />
          <Furniture kind={kind} palette={palette} assembly={() => 1} />
        </View>
      )}
    </span>
  );
}

/**
 * The pieces that come with a set, as a rail of thumbnails beside the stage.
 *
 * Shown only when a product really is a set -- piecesOf returns one piece for everything
 * else, and one thumbnail of the thing already on screen would be noise.
 */
function PieceRail({
  pieces,
  active,
  onPick,
  palette,
}: {
  pieces: FurnitureKind[];
  active: FurnitureKind;
  onPick: (k: FurnitureKind) => void;
  palette: Palette;
}) {
  return (
    <div className="piece-rail" role="group" aria-label="Pieces in this set">
      {pieces.map((k) => (
        <button
          key={k}
          type="button"
          className={`piece-thumb ${k === active ? "on" : ""}`}
          aria-pressed={k === active}
          onClick={() => onPick(k)}
        >
          <PieceThumb kind={k} palette={palette} />
          <small>{KIND_LABEL[k]}</small>
        </button>
      ))}
    </div>
  );
}

/**
 * Interactive 3D preview: the real model of this product when one has been generated,
 * otherwise the representative model for its kind of furniture.
 *
 * Only the planner used to show the generated models, so a product with its own 3D scan
 * still displayed a generic sofa here -- the one page where a customer is deciding on
 * that exact piece. Reading is deliberately passive (`start: false`): a product page view
 * never orders a new model, which would bill per visit once FAL_KEY is set.
 */
function Preview3D({
  kind,
  slug,
  name,
  category,
  details,
  fabric,
  wood,
}: {
  kind: FurnitureKind;
  slug: string;
  name: string;
  category: string;
  /** The listing's bullet points: a set spells out its contents there. */
  details: readonly string[];
  fabric: string;
  wood: string;
}) {
  /*
   * Which piece of the set is on the stage.
   *
   * `pieces[0]` is always the product's own `kind`, so a single product behaves exactly
   * as it did and renders no picker. For a set, the others are the pieces that come with
   * it -- the chairs that come with the table, the wardrobe that comes with the bed.
   */
  const pieces = piecesOf(name, category, kind, details);
  const [piece, setPiece] = useState<FurnitureKind>(kind);
  const shownKind = pieces.includes(piece) ? piece : kind;
  const [explode, setExplode] = useState(0);
  const [hour, setHour] = useState(15);
  const [spin, setSpin] = useState(true);
  const [preset, setPreset] = useState<Preset>("angle");
  const explodeRef = useRef(0);
  const hourRef = useRef(15);
  useEffect(() => {
    explodeRef.current = explode;
    hourRef.current = hour;
  }, [explode, hour]);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<THREE.Vector3 | null>(null);
  const mounted = useRef<number | null>(null);
  const frame = frameFor(shownKind, 1.15);
  const palette = { fabric, wood, metal: "#2b2b2b" };
  const ai = useAiModel(slug, true, false);
  /*
   * A scanned model is a scan of the product as listed, which is its leading piece. Ask
   * to see the chairs that come with the table and the scan of the table is the wrong
   * answer, so the drawn piece is used for everything except the piece the scan is of.
   */
  const real = ai.status === "ready" && shownKind === kind;
  const [fw, fd] = FOOTPRINT[shownKind];

  /*
   * Pick a piece of the set, and re-frame the camera for it.
   *
   * A wardrobe is two metres tall and a bedside table is half of one, so the camera set
   * up for the bed leaves the next piece either tiny or out of frame. The camera prop
   * below only applies on mount, so the move goes through the same goal the view buttons
   * use, and the orbit centre moves with it.
   */
  function pickPiece(k: FurnitureKind) {
    const f = frameFor(k, 1.15);
    setPiece(k);
    setPreset("angle");
    setSpin(false);
    goal.current = new THREE.Vector3(...f.position);
    controls.current?.target.set(...f.target);
  }

  /*
   * A still of this exact product, shown in place of the 3D scene.
   *
   * Drop a file at public/3d-preview/<slug>.jpg and it is used; no code change and no
   * database column. Products without one fall through to the 3D scene below, which is
   * what the onError does -- the browser tells us the file is not there.
   */
  const [stillOk, setStillOk] = useState(true);
  const still = `/3d-preview/${slug}.jpg`;
  // Like the scan above, the still is a picture of the product as listed, so it stands
  // in only while its own piece is the one being shown.
  if (stillOk && shownKind === kind) {
    return (
      <div className="stage-3d">
        <img
          src={still}
          alt={`${name} shown in 3D`}
          onError={() => setStillOk(false)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {pieces.length > 1 && <PieceRail pieces={pieces} active={shownKind} onPick={pickPiece} palette={palette} />}
      </div>
    );
  }

  function goTo(p: Preset) {
    const [tx, ty, tz] = frame.target;
    const dist = new THREE.Vector3(...frame.position).distanceTo(new THREE.Vector3(...frame.target));
    const pos: Record<Preset, [number, number, number]> = {
      angle: frame.position,
      front: [tx, ty + dist * 0.12, tz + dist],
      // Straight behind the piece. On a generated model this is the inferred side, so it
      // is also the honest test of how good the reconstruction actually is.
      back: [tx, ty + dist * 0.12, tz - dist],
      side: [tx + dist, ty + dist * 0.12, tz],
      top: [tx + 0.001, ty + dist * 1.05, tz + 0.001],
    };
    goal.current = new THREE.Vector3(...pos[p]);
    setPreset(p);
    setSpin(false);
  }

  return (
    <div className="stage-3d" ref={setTrackEl}>
      <View style={{ position: "absolute", inset: 0 }}>
        <PerspectiveCamera makeDefault fov={32} position={frame.position} />
        {trackEl && (
          <OrbitControls
            ref={controls}
            domElement={trackEl}
            target={frame.target}
            enablePan={false}
            enableZoom={false}
            enableDamping
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={spin && explode < 0.05}
            autoRotateSpeed={0.6}
            onStart={() => {
              goal.current = null;
              setSpin(false);
            }}
          />
        )}
        <CameraDirector goal={goal} controls={controls} />
        <SceneLights hour={() => hourRef.current} shadowSize={2.5} />
        <ShadowFloor opacity={0.3} />
        {real && ai.status === "ready" ? (
          <AiModel url={ai.url} width={fw} depth={fd} height={HEIGHT[shownKind]} />
        ) : (
          <Furniture
            kind={shownKind}
            palette={palette}
            spread={0.8}
            glow={() => daylightAt(hourRef.current).glow}
            assembly={() => {
              mounted.current ??= performance.now();
              return Math.min(1, (performance.now() - mounted.current) / 2600);
            }}
            explode={() => explodeRef.current}
          />
        )}
      </View>
      {pieces.length > 1 && <PieceRail pieces={pieces} active={shownKind} onPick={pickPiece} palette={palette} />}
      <div className="view-presets" role="group" aria-label="Camera view">
        {(["angle", "front", "back", "side", "top"] as Preset[]).map((p) => (
          <button key={p} aria-pressed={preset === p && !spin} onClick={() => goTo(p)}>
            {p === "angle" ? "3/4" : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <p className="preview-note">
        {real
          ? "A 3D model of this exact piece — drag to turn it, or use the views above."
          : "Representative 3D model — use it to preview style, colour and how it's built."}
      </p>
      <div className="hud">
        {/* Exploded view pulls apart the procedural model's individual parts. A generated
            mesh is one solid piece, so the slider would do nothing but mislead. */}
        {!real && (
          <label className="explode">
            Exploded view · {Math.round(explode * 100)}%
            <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} />
          </label>
        )}
        <label className="explode">
          Light · {String(Math.floor(hour)).padStart(2, "0")}:00
          <input type="range" min={7} max={22} step={0.1} value={hour} onChange={(e) => setHour(+e.target.value)} />
        </label>
      </div>
    </div>
  );
}

export default Preview3D;
