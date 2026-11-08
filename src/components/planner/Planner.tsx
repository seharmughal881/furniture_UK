"use client";

import { Html, OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCart } from "@/components/commerce/CartProvider";
import { shopifyImage } from "@/lib/images";
import { formatPrice, type Palette, type ProductSummary, type RoomItem } from "@/lib/types";
import { daylightAt, formatHour } from "@/three/daylight";
import { FOOTPRINT, KIND_LABEL, STACKABLE, SURFACE, type FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/FurniturePiece";
import { analyseProductImage, type ProductLook } from "@/three/productLook";
import { ProductPhoto } from "@/three/ProductPhoto";
import { AiModel, useAiModel } from "@/three/AiModel";

/** How furniture is drawn: AI-generated 3D of the real product, its cut-out photo, or simple 3D shapes. */
export type DisplayMode = "ai" | "photo" | "simple";

// The free AI 3D models (Colab/TripoSR) look rough, which is why this was off. All 182 of
// them are now imported and 'ready' in product_models, so the mode costs nothing to show
// and nobody waits for generation. Set back to false to hide it again.
const AI_MODELS = true;
import { compositionFootprint, compositionFor } from "@/three/sets";
import { HEIGHT } from "@/three/furniture";
import { getProceduralTextures } from "@/three/materials";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

const ROOM = { w: 6, d: 5 };

/**
 * How far from the middle a piece may be dragged.
 *
 * Pieces used to be clamped to the walls, so a sofa could not be stood outside to compare
 * two of them side by side, or parked off to one side while the room was rearranged. The
 * drag already raycasts an infinite ground plane, so only the clamp was in the way.
 *
 * This is not an arbitrary apron round the room: it is the limit the saved-room format
 * already imposes. roomItemSchema in lib/validation.ts accepts x and z within +/-10, so
 * anywhere a piece can be dragged to is somewhere the layout can still be saved and
 * shared from. Allowing more would let someone build a room that is silently rejected the
 * moment they press save.
 */
const REACH = 9.8;

/** One press of +/- resizes a piece by 10%. */
const SCALE_STEP = 1.1;
const SNAP = 0.05;
const BASE_PALETTE: Palette = { fabric: "#e8e0d2", wood: "#6b4a33", metal: "#2b2b2b" };
const paletteFor = (colour?: string): Palette => ({ ...BASE_PALETTE, fabric: colour || BASE_PALETTE.fabric });

const GROUPS = [
  { key: "living", name: "Living room" },
  { key: "bedroom", name: "Bedroom" },
  { key: "dining", name: "Dining room" },
  { key: "other", name: "Other" },
];
const groupOf = (p: ProductSummary) => (["living", "bedroom", "dining"].includes(p.rooms[0]) ? p.rooms[0] : "other");

/* ------------------------------------------------------- resizable side panel */

/**
 * Panel width limits in px. The floor is the narrowest that still fits two piece cards
 * even on a platform with classic 17px scrollbars -- measured, not guessed: the piece grid
 * gets the panel width less 44px of padding and the scrollbar.
 */
const SIDE_W = { min: 300, max: 560, initial: 340 };
const SIDE_W_KEY = "planner:side-width";

/** Never let the panel take more than half the window, however wide SIDE_W.max is. */
const maxSideWidth = () => Math.min(SIDE_W.max, Math.round(window.innerWidth / 2));
const clampSideWidth = (px: number) => Math.min(maxSideWidth(), Math.max(SIDE_W.min, Math.round(px)));

/** Put the width on the element. This is what actually moves the panel; see globals.css. */
const applyWidth = (planner: HTMLElement | null, px: number) =>
  planner?.style.setProperty("--planner-side-w", `${px}px`);

/**
 * The width lives outside React.
 *
 * Two reasons. It has to be read from localStorage on the first client render without the
 * server and the client disagreeing -- getServerSnapshot hands back the default, so the
 * restored value arrives on the re-render instead of corrupting hydration. And a drag
 * writes the live value straight to the DOM, so nothing here is touched until the pointer
 * is released.
 */
const sideWidthStore = (() => {
  let value = SIDE_W.initial;
  let loaded = false;
  const listeners = new Set<() => void>();
  return {
    /** Cached, as getSnapshot must return a stable value between changes. */
    get() {
      if (!loaded) {
        loaded = true;
        try {
          const saved = Number(localStorage.getItem(SIDE_W_KEY));
          if (Number.isFinite(saved) && saved > 0) value = clampSideWidth(saved);
        } catch {
          // private mode: keep the default
        }
      }
      return value;
    },
    getOnServer: () => SIDE_W.initial,
    set(px: number) {
      if (px === value) return;
      value = px;
      try {
        localStorage.setItem(SIDE_W_KEY, String(px));
      } catch {
        // storage full or blocked: the panel still resized, it just won't be remembered
      }
      for (const l of listeners) l();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
})();

/**
 * Drag-to-resize for the left panel.
 *
 * A drag writes straight to the CSS custom property through the DOM. Routing every
 * pointermove through setState would re-render this component -- and with it the whole 3D
 * room -- on every frame of the drag; this way a drag costs the browser one grid
 * recalculation, and the store is updated once, on release.
 *
 * Nothing has to be told about the new size: drei's <View> re-reads its element's bounding
 * box every frame, so the room follows the stage on its own.
 *
 * There is no breakpoint check here. Under 960px the planner stacks and the handle is
 * display:none, which also takes it out of the tab order -- so the layout decides whether
 * resizing is on offer, in the one place that already owns that breakpoint.
 */
function useSideResize(plannerRef: React.RefObject<HTMLElement | null>) {
  const width = useSyncExternalStore(sideWidthStore.subscribe, sideWidthStore.get, sideWidthStore.getOnServer);
  const [dragging, setDragging] = useState(false);

  const commit = useCallback((planner: HTMLElement | null, px: number) => {
    applyWidth(planner, px);
    sideWidthStore.set(px);
  }, []);

  // Push the restored width onto the element; the CSS default covers the first paint.
  useEffect(() => {
    applyWidth(plannerRef.current, width);
  }, [plannerRef, width]);

  // A narrower window lowers the ceiling, so pull an over-wide panel back inside it.
  useEffect(() => {
    const onResize = () => {
      const next = clampSideWidth(width);
      if (next !== width) commit(plannerRef.current, next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [commit, plannerRef, width]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const planner = e.currentTarget.closest<HTMLElement>(".planner");
    if (!planner) return;
    e.preventDefault();
    // Capture, so the pointer keeps reporting to the handle even once it has travelled
    // over the canvas -- which would otherwise hand the drag to OrbitControls.
    e.currentTarget.setPointerCapture(e.pointerId);
    const originX = planner.getBoundingClientRect().left;
    // Local to this one drag, so the live value needs no ref and no state.
    let latest = clampSideWidth(sideWidthStore.get());
    setDragging(true);
    document.body.classList.add("planner-resizing");

    const move = (ev: PointerEvent) => {
      latest = clampSideWidth(ev.clientX - originX);
      applyWidth(planner, latest);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.classList.remove("planner-resizing");
      setDragging(false);
      applyWidth(planner, latest);
      sideWidthStore.set(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, []);

  /** Arrow keys resize, Shift coarsens the step, Home/End jump to the limits. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 48 : 16;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = width - step;
      else if (e.key === "ArrowRight") next = width + step;
      else if (e.key === "Home") next = SIDE_W.min;
      else if (e.key === "End") next = maxSideWidth();
      else if (e.key === "Enter" || e.key === " ") next = SIDE_W.initial;
      if (next === null) return;
      e.preventDefault();
      commit(e.currentTarget.closest<HTMLElement>(".planner"), clampSideWidth(next));
    },
    [commit, width],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => commit(e.currentTarget.closest<HTMLElement>(".planner"), SIDE_W.initial),
    [commit],
  );

  return { width, dragging, onPointerDown, onKeyDown, onDoubleClick };
}

/**
 * Edit tokens for rooms saved from this browser.
 *
 * A room's id is its share link, so the id cannot also be the permission to change it.
 * The server returns a secret token once, when the room is first saved; keeping it here
 * is what lets this browser — and only this browser — go on editing that room. Someone
 * opening a shared link has no token, so their save creates a copy instead.
 *
 * localStorage, not a cookie: it never needs to reach the server except as this one
 * header, and every read is guarded because it throws in private windows and when site
 * data is blocked.
 */
const TOKEN_KEY = "atelier_room_tokens";

function readEditTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const editTokenFor = (roomId: string): string | null => readEditTokens()[roomId] ?? null;

function rememberEditToken(roomId: string, token: string): void {
  try {
    // Keep the most recent few only, so this never grows without bound.
    const all = { ...readEditTokens(), [roomId]: token };
    const trimmed = Object.fromEntries(Object.entries(all).slice(-20));
    localStorage.setItem(TOKEN_KEY, JSON.stringify(trimmed));
  } catch {
    // Saving still worked; this browser just will not be able to edit in place later.
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clampX = (v: number) => Math.min(REACH, Math.max(-REACH, v));
const clampZ = (v: number) => Math.min(REACH, Math.max(-REACH, v));

const PI = Math.PI;
type Spot = [FurnitureKind, number, number, number?];
// Ready-made layouts. Back wall is z = -2.5, left wall x = -3. A chair's seat faces +z at rot 0.
const PRESETS: Record<string, { name: string; spots: Spot[] }> = {
  living: {
    name: "My living room",
    spots: [
      ["sofa", 0, -1.75], ["coffeeTable", 0, -0.55], ["armchair", -1.75, -0.45, 1.2], ["armchair", 1.75, -0.45, -1.2],
      ["sideTable", -1.4, -2.05], ["mediaConsole", 0, 2.05, PI],
    ],
  },
  bedroom: {
    name: "My bedroom",
    spots: [
      ["bed", 0, -1.35], ["nightstand", -1.2, -2.25], ["nightstand", 1.2, -2.25], ["dresser", -2.7, 0.3, PI / 2],
      ["wardrobe", 2.62, -1.3, -PI / 2], ["mirror", -2.72, -1.6, PI / 2],
    ],
  },
  dining: {
    name: "My dining room",
    spots: [
      ["diningTable", 0, 0],
      ["diningChair", -0.45, 0.62, PI], ["diningChair", 0.45, 0.62, PI], ["diningChair", -0.45, -0.62], ["diningChair", 0.45, -0.62],
      ["diningChair", 1.12, 0, -PI / 2], ["diningChair", -1.12, 0, PI / 2],
    ],
  },
};

/** The product a preset uses for each kind: the first in stock (a table on its own rather than a set). */
function defaultsByKind(products: ProductSummary[]) {
  const m = new Map<FurnitureKind, ProductSummary>();
  for (const p of products) {
    if (!p.kind || !p.inStock || m.has(p.kind)) continue;
    if (p.kind === "diningTable" && /chair|set/i.test(p.name)) continue;
    m.set(p.kind, p);
  }
  return m;
}

const presetItems = (key: string, defaults: Map<FurnitureKind, ProductSummary>): RoomItem[] =>
  (PRESETS[key] ?? PRESETS.living).spots
    .filter(([kind]) => defaults.has(kind))
    .map(([kind, x, z, rot = 0]) => ({ id: uid(), kind, slug: defaults.get(kind)!.slug, x, z, rot }));

/**
 * Geometry for a piece that has been turned to an arbitrary angle.
 *
 * Both of these replace `Math.round(rot / (PI / 2)) % 2`, which rounded every rotation to
 * the nearest quarter turn and could only ever swap width for depth. That was true enough
 * while pieces could only be turned in 45-degree steps and landed square more often than
 * not, but the turn slider sets any angle: a 2.0 x 1.0 m sofa at 45 degrees covers a
 * 2.12 x 2.12 m square of floor, and the old code still thought it covered 2.0 x 1.0.
 * Neither accounted for the piece's own scale either.
 */

/** Half-extents of the axis-aligned box around a w x d footprint turned by `rot`. */
function turnedHalfExtents(w: number, d: number, rot: number, scale = 1): [number, number] {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return [(scale * (w * c + d * s)) / 2, (scale * (w * s + d * c)) / 2];
}

/**
 * A point in the piece's own frame, expressed in the room's.
 *
 * Matches three.js's rotation about Y, which the item's <group rotation-y> applies:
 * x' = x cos + z sin, z' = -x sin + z cos.
 */
function turnPoint(x: number, z: number, rot: number, scale = 1): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [scale * (x * c + z * s), scale * (-x * s + z * c)];
}

/** Height a stackable item (a table lamp) should sit at: the top of any surface it is placed over. */
function standHeight(it: RoomItem, items: RoomItem[]) {
  if (!STACKABLE.includes(it.kind)) return 0;
  let y = 0;
  for (const o of items) {
    const top = SURFACE[o.kind];
    if (!top || o.id === it.id) continue;
    const [w, d] = FOOTPRINT[o.kind];
    const scale = o.scale ?? 1;
    // Turn the lamp's position back into the surface's own frame and compare against the
    // plain rectangle. Exact at any angle, where a bounding box would lift a lamp that
    // sits just off the corner of a table standing at 45 degrees.
    const [lx, lz] = turnPoint(it.x - o.x, it.z - o.z, -o.rot);
    if (Math.abs(lx) <= (w * scale) / 2 && Math.abs(lz) <= (d * scale) / 2) y = Math.max(y, top * scale);
  }
  return y;
}

export const WALLS = [
  { name: "White", hex: "#f4f4f1" },
  { name: "Cream", hex: "#efe6d6" },
  { name: "Beige", hex: "#d8c4a5" },
  { name: "Grey", hex: "#b8b8b6" },
  { name: "Sage", hex: "#a7b39a" },
  { name: "Brown", hex: "#8a6a4f" },
  { name: "Navy", hex: "#3a4560" },
  { name: "Charcoal", hex: "#3a3a3a" },
];
/**
 * How much of the room is drawn. "none" leaves the furniture on the page background,
 * which is what you want to photograph a piece on its own or compare two side by side;
 * "floor" drops just the walls, which otherwise hide anything stood behind them.
 */
export type Shell = "walls" | "floor" | "none";
export const SHELLS: { key: Shell; name: string }[] = [
  { key: "walls", name: "Walls & floor" },
  { key: "floor", name: "Floor only" },
  { key: "none", name: "No room" },
];

export const FLOORS = [
  { key: "oak", name: "Light oak", hex: "#d6bd96", wood: true },
  { key: "walnut", name: "Walnut", hex: "#7a5a40", wood: true },
  { key: "marble", name: "White marble", hex: "#ecebe7", wood: false },
  { key: "tile", name: "Grey tile", hex: "#9d9d9b", wood: false },
];

function Room({ wall, floor, shell }: { wall: string; floor: string; shell: Shell }) {
  const f = FLOORS.find((x) => x.key === floor) ?? FLOORS[0];
  const floorMap = useMemo(() => {
    const t = getProceduralTextures().wood.clone();
    t.repeat.set(3, 6);
    t.rotation = Math.PI / 2;
    t.needsUpdate = true;
    return t;
  }, []);
  // the side wall is a touch darker so the corner reads in 3D
  const side = useMemo(() => "#" + new THREE.Color(wall).multiplyScalar(0.93).getHexString(), [wall]);
  return (
    <group>
      {/*
        Ground for everywhere outside the room, so a piece dragged out still casts a
        shadow and reads as standing on something rather than floating. shadowMaterial
        draws nothing but the shadow itself, so the page background shows through and the
        area stays white -- an opaque plane here put a grey field round the room instead.
        A couple of millimetres below the room floor, which is opaque and covers it.
      */}
      <group position-y={-0.002}>
        <ShadowFloor size={REACH * 2 + ROOM.w} />
      </group>
      {shell !== "none" && (
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[ROOM.w, ROOM.d]} />
          <meshStandardMaterial
            key={f.key}
            map={f.wood ? floorMap : null}
            color={f.hex}
            roughness={f.wood ? 0.75 : f.key === "marble" ? 0.25 : 0.6}
          />
        </mesh>
      )}
      {shell !== "none" && (
        <gridHelper args={[ROOM.w, ROOM.w * 2, "#8a7457", "#8a7457"]} position-y={0.002} scale={[1, 1, ROOM.d / ROOM.w]}>
          <lineBasicMaterial attach="material" color="#5a4630" transparent opacity={f.wood ? 0.12 : 0.22} />
        </gridHelper>
      )}
      {/* two walls so the light has something to land on */}
      {shell === "walls" && (
        <>
          <mesh position={[0, 1.3, -ROOM.d / 2 - 0.05]} receiveShadow castShadow>
            <boxGeometry args={[ROOM.w + 0.2, 2.6, 0.1]} />
            <meshStandardMaterial color={wall} roughness={0.95} />
          </mesh>
          <mesh position={[-ROOM.w / 2 - 0.05, 1.3, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.1, 2.6, ROOM.d]} />
            <meshStandardMaterial color={side} roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Colours + photo info read from the product's own photo (null until ready / if unavailable). */
function useProductLook(image: string | null | undefined) {
  const [look, setLook] = useState<{ url: string; look: ProductLook | null } | null>(null);
  useEffect(() => {
    if (!image) return;
    let alive = true;
    const url = shopifyImage(image, 600);
    analyseProductImage(url).then((l) => alive && setLook({ url, look: l }));
    return () => {
      alive = false;
    };
  }, [image]);
  return look;
}

/** One planned product: the real photo (cut-outs, in photo mode) or 3D stand-ins coloured from the photo. */
function PlacedProduct({
  kind,
  product,
  mode,
  glow,
  selected,
}: {
  kind: FurnitureKind;
  product: ProductSummary | undefined;
  mode: DisplayMode;
  glow: () => number;
  selected: boolean;
}) {
  const info = useProductLook(product?.image);
  const look = info?.look;
  const pieces = useMemo(() => (product ? compositionFor(product.name, kind) : [{ kind, x: 0, z: 0, rot: 0 }]), [product, kind]);
  const [w, d, cx, cz] = useMemo(() => compositionFootprint(pieces), [pieces]);
  const palette = look?.palette ?? paletteFor(product?.colour);
  const ai = useAiModel(product?.slug, mode === "ai");
  /*
   * What to draw: the real 3D model, a cut-out photo, or the procedural shapes.
   *
   * "AI 3D" never falls back to a photo. A cut-out is one flat plane kept upright by a
   * billboard, so it is honest from eye level and collapses to a sliver as soon as the
   * camera looks down on the room -- and in a mode called "real shape", next to pieces
   * that are solid from every angle, that reads as broken rather than as a stand-in.
   * Procedural geometry is a generic shape but it is real geometry, so a room in this
   * mode now holds up however it is turned and whatever angle it is viewed from.
   *
   * "Product photos" is the mode for someone who wants the actual photograph, and keeps
   * the cut-out; pieces with no usable cut-out still fall through to the shapes.
   */
  const showAi = mode === "ai" && ai.status === "ready";
  const showPhoto = mode === "photo" && look?.cutout && info;
  const making = mode === "ai" && ai.status === "queued";
  const tallest = Math.max(...pieces.map((q) => HEIGHT[q.kind]));

  return (
    <>
      {showAi && ai.status === "ready" ? (
        <group position={[cx, 0, cz]}>
          <AiModel url={ai.url} width={w} depth={d} height={tallest * 1.05} />
        </group>
      ) : showPhoto ? (
        <group position={[cx, 0, cz]}>
          <ProductPhoto url={shopifyImage(product!.image!, 900)} height={tallest * 1.1} maxWidth={Math.max(w * 1.5, 1.2)} />
        </group>
      ) : (
        pieces.map((p, i) => (
          <group key={`${p.kind}-${i}`} position={[p.x, 0, p.z]} rotation-y={p.rot} scale={[p.scaleX ?? 1, 1, 1]}>
            <Furniture
              kind={p.kind}
              palette={pieces.length > 1 && p.kind === "armchair" && look?.accent ? { ...palette, fabric: look.accent } : palette}
              spread={0.6}
              glow={glow}
              delay={i * 0.12}
            />
          </group>
        ))
      )}
      {making && (
        <Html position={[cx, tallest + 0.35, cz]} center distanceFactor={6} zIndexRange={[20, 0]}>
          <span className="ai-making">✨ Creating 3D model…</span>
        </Html>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position={[cx, 0.004, cz]} userData={{ noHit: true }}>
          <planeGeometry args={[w + 0.16, d + 0.16]} />
          <meshBasicMaterial color="#c8102e" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

/**
 * Whether a ray hit is a real, visible surface of a piece. Furniture also carries edge outlines
 * (for the build-up animation) that three.js counts as hit anywhere within 1 m of the ray, even
 * when hidden, so a click on one piece could grab its neighbour. Only solid visible meshes count,
 * and on product photos only the product itself, not the transparent area around it.
 */
function pickable(h: THREE.Intersection) {
  const o = h.object as THREE.Mesh;
  if (!o.isMesh || o.userData.noHit) return false;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.every((m) => !m.visible || (m.transparent && m.opacity < 0.05))) return false;
  const alpha = o.userData.hitAlpha as ImageData | undefined;
  if (alpha && h.uv) {
    const x = Math.min(alpha.width - 1, Math.floor(h.uv.x * alpha.width));
    const y = Math.min(alpha.height - 1, Math.floor((1 - h.uv.y) * alpha.height));
    if (alpha.data[(y * alpha.width + x) * 4 + 3] < 128) return false;
  }
  return true;
}

function PlannerScene({
  items,
  productOf,
  mode,
  wall,
  floor,
  shell,
  selected,
  hour,
  track,
  onSelect,
  onMove,
}: {
  items: RoomItem[];
  productOf: (it: RoomItem) => ProductSummary | undefined;
  mode: DisplayMode;
  wall: string;
  floor: string;
  shell: Shell;
  selected: string | null;
  hour: number;
  track: HTMLDivElement;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
}) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);

  // Fit the whole room in view: on narrow (portrait) screens move the camera further back.
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const base = new THREE.Vector3(4.3, 5.0, 6.0);
    const fit = Math.max(1, 1.45 / aspect);
    const dir = camera.position.lengthSq() > 0.01 ? camera.position.clone().normalize() : base.clone().normalize();
    camera.position.copy(dir.multiplyScalar(base.length() * fit));
    controls.current?.update();
  }, [aspect, camera]);
  const groups = useRef(new Map<string, THREE.Group>());
  const hourRef = useRef(hour);
  // Latest callbacks for the native listeners below.
  const cb = useRef({ onSelect, onMove });
  useEffect(() => {
    hourRef.current = hour;
    cb.current = { onSelect, onMove };
  }, [hour, onSelect, onMove]);

  useEffect(() => {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let drag: { id: string; dx: number; dz: number } | null = null;
    let downAt = { x: 0, y: 0 };

    const toRay = (e: PointerEvent) => {
      const r = track.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };

    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input")) return;
      downAt = { x: e.clientX, y: e.clientY };
      toRay(e);
      const first = ray.intersectObjects([...groups.current.values()], true).find(pickable);
      if (!first) return;
      let obj: THREE.Object3D | null = first.object;
      while (obj && !obj.userData.itemId) obj = obj.parent;
      if (!obj) return;
      const id = obj.userData.itemId as string;
      cb.current.onSelect(id);
      if (ray.ray.intersectPlane(floor, hit)) {
        drag = { id, dx: obj.position.x - hit.x, dz: obj.position.z - hit.z };
        if (controls.current) controls.current.enabled = false;
        track.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      toRay(e);
      if (ray.ray.intersectPlane(floor, hit)) {
        cb.current.onMove(drag.id, clampX(snap(hit.x + drag.dx)), clampZ(snap(hit.z + drag.dz)));
      }
    };
    const up = (e: PointerEvent) => {
      const wasDrag = drag;
      drag = null;
      if (controls.current) controls.current.enabled = true;
      // a click on empty floor (not an orbit drag) clears the selection
      if (!wasDrag && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4) {
        if (!(e.target as HTMLElement).closest("button, input")) cb.current.onSelect(null);
      }
    };

    track.addEventListener("pointerdown", down, { capture: true });
    track.addEventListener("pointermove", move);
    track.addEventListener("pointerup", up);
    return () => {
      track.removeEventListener("pointerdown", down, { capture: true });
      track.removeEventListener("pointermove", move);
      track.removeEventListener("pointerup", up);
    };
  }, [camera, track]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={36} position={[4.3, 5.0, 6.0]} />
      <OrbitControls
        ref={controls}
        domElement={track}
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        minDistance={4}
        maxDistance={28}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.4}
      />
      {/* Covers well past the room: at 5 a piece dragged outside it lost its shadow and
          looked pasted on. Spreading the same shadow map over more ground softens it, so
          this is a compromise rather than the full REACH. */}
      <SceneLights hour={() => hourRef.current} shadowSize={10} />
      <Room wall={wall} floor={floor} shell={shell} />
      {items.map((it) => {
        return (
          <group
            key={it.id}
            position={[it.x, standHeight(it, items), it.z]}
            rotation-y={it.rot}
            scale={it.scale ?? 1}
            userData={{ itemId: it.id }}
            ref={(g) => {
              if (g) groups.current.set(it.id, g);
              else groups.current.delete(it.id);
            }}
          >
            <PlacedProduct
              kind={it.kind}
              product={productOf(it)}
              mode={mode}
              glow={() => daylightAt(hourRef.current).glow}
              selected={selected === it.id}
            />
          </group>
        );
      })}
    </>
  );
}

export function Planner({ products }: { products: ProductSummary[] }) {
  const router = useRouter();
  const { add: addToCart, busy } = useCart();
  const params = useSearchParams();
  const roomParam = params.get("room");

  const plannerRef = useRef<HTMLElement>(null);
  const side = useSideResize(plannerRef);

  const startPreset = params.get("preset") ?? "living";
  const defaults = useMemo(() => defaultsByKind(products), [products]);
  const [items, setItems] = useState<RoomItem[]>(() => presetItems(startPreset, defaults));
  const [selected, setSelected] = useState<string | null>(null);
  const [hour, setHour] = useState(16);
  const [wall, setWall] = useState(WALLS[0].hex);
  const [floor, setFloor] = useState(FLOORS[0].key);
  const [mode, setMode] = useState<DisplayMode>("simple");
  const [shell, setShell] = useState<Shell>("walls");
  const [name, setName] = useState(() => (PRESETS[startPreset] ?? PRESETS.living).name);
  const [roomId, setRoomId] = useState<string | null>(null);
  // Whether this browser holds the edit token for the loaded room, which decides if
  // saving updates it or saves a copy. Set in an effect, never read during render:
  // localStorage does not exist on the server, so reading it inline would make the
  // button's label differ between the server and client renders.
  const [canEditRoom, setCanEditRoom] = useState(false);
  const [status, setStatus] = useState("");
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);

  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  // older saved rooms have no slug: fall back to the default product for that kind
  const productOf = useCallback(
    (it: RoomItem) => (it.slug ? bySlug.get(it.slug) : undefined) ?? defaults.get(it.kind),
    [bySlug, defaults],
  );
  const total = items.reduce((s, it) => s + (productOf(it)?.priceCents ?? 0), 0);
  const selectedItem = items.find((it) => it.id === selected);
  // rot is free-running radians (each Rotate press subtracts a quarter turn), so bring it
  // back into 0-359 for the slider rather than letting the handle run off the end.
  const selectedAngle = ((((selectedItem?.rot ?? 0) * 180) / Math.PI) % 360 + 360) % 360;

  // Load a saved room from the URL.
  useEffect(() => {
    if (!roomParam || roomParam === roomId) return;
    let cancelled = false;
    fetch(`/api/rooms/${roomParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then(({ room }) => {
        if (cancelled) return;
        setItems(room.layout);
        setName(room.name);
        if (room.style?.wall) setWall(room.style.wall);
        if (room.style?.floor) setFloor(room.style.floor);
        if (room.style?.mode) setMode(room.style.mode === "ai" && !AI_MODELS ? "simple" : room.style.mode);
        else if (typeof room.style?.photos === "boolean") setMode(room.style.photos ? "photo" : "simple");
        // Rooms saved before the room could be hidden have no shell: they were all drawn
        // with walls, so that is what they should come back as.
        if (room.style?.shell) setShell(room.style.shell);
        setRoomId(room.id);
        // Someone opening a shared link holds no token, so their save becomes a copy.
        setCanEditRoom(Boolean(editTokenFor(room.id)));
      })
      .catch(() => !cancelled && setLoadFailed(roomParam));
    return () => {
      cancelled = true;
    };
  }, [roomParam, roomId]);

  const applyPreset = (key: string) => {
    setItems(presetItems(key, defaults));
    setSelected(null);
    if (Object.values(PRESETS).some((p) => p.name === name)) setName(PRESETS[key].name);
  };

  const [added, setAdded] = useState<{ name: string; image: string | null; replaced: number; at: string } | null>(null);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 3500);
    return () => clearTimeout(t);
  }, [added]);

  /** Room-space rectangle an item covers (accounts for sets and rotation). */
  const rectOf = useCallback(
    (it: { kind: FurnitureKind; x: number; z: number; rot: number; scale?: number }, name?: string) => {
      const [w, d, cx, cz] = compositionFootprint(compositionFor(name ?? "", it.kind));
      const scale = it.scale ?? 1;
      const [hw, hd] = turnedHalfExtents(w, d, it.rot, scale);
      // cx/cz are measured inside the piece, so they turn and scale with it.
      const [ox, oz] = turnPoint(cx, cz, it.rot, scale);
      return { x0: it.x + ox - hw, x1: it.x + ox + hw, z0: it.z + oz - hd, z1: it.z + oz + hd };
    },
    [],
  );

  const add = (p: ProductSummary) => {
    if (!p.kind) return;
    const kind = p.kind;
    const id = uid();
    const pieces = compositionFor(p.name, kind);
    const isSet = pieces.length > 1;
    const xs = items;
    let keep = xs;
    let spot = { x: 0, z: 0 };
    {
      if (isSet) {
        // a set replaces the pieces it already contains (old sofas, chairs, tables...)
        const kinds = new Set(pieces.map((q) => q.kind));
        keep = xs.filter((it) => !kinds.has(it.kind) || it.kind === "rug");

        const r = rectOf({ kind, x: 0, z: 0, rot: 0 }, p.name);
        // keep the whole set inside the room
        spot = {
          x: snap(Math.min(ROOM.w / 2 - r.x1 - 0.1, Math.max(-ROOM.w / 2 - r.x0 + 0.1, 0))),
          z: snap(Math.min(ROOM.d / 2 - r.z1 - 0.1, Math.max(-ROOM.d / 2 - r.z0 + 0.1, -0.3))),
        };
      } else {
        // first free spot on a grid, nearest the middle of the room
        const others = keep.map((it) => rectOf(it, productOf(it)?.name));
        const cands: { x: number; z: number }[] = [];
        for (let z = -2.2; z <= 2.2; z += 0.25) for (let x = -2.7; x <= 2.7; x += 0.25) cands.push({ x, z });
        cands.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
        const fits = (c: { x: number; z: number }) => {
          const r = rectOf({ kind, x: c.x, z: c.z, rot: 0 }, p.name);
          if (r.x0 < -ROOM.w / 2 || r.x1 > ROOM.w / 2 || r.z0 < -ROOM.d / 2 || r.z1 > ROOM.d / 2) return false;
          return others.every((o) => r.x1 + 0.05 < o.x0 || r.x0 - 0.05 > o.x1 || r.z1 + 0.05 < o.z0 || r.z0 - 0.05 > o.z1);
        };
        spot = cands.find(fits) ?? { x: 0, z: 0.8 };
      }
    }
    setItems([...keep, { id, kind, slug: p.slug, x: snap(spot.x), z: snap(spot.z), rot: 0 }]);
    setSelected(id);
    setAdded({ name: p.name, image: p.image, replaced: xs.length - keep.length, at: id });
    // on phones/tablets the list sits below the room: bring the room back into view to see the piece land
    if (window.innerWidth < 960) track?.scrollIntoView({ behavior: "smooth", block: "end" });
  };
  const rotate = useCallback(
    (id: string | null) => id && setItems((xs) => xs.map((it) => (it.id === id ? { ...it, rot: it.rot - Math.PI / 4 } : it))),
    [],
  );
  /**
   * Resize one piece. The catalogue size is only a guess for most products -- 0 of the
   * 183 placeable ones carry real dimensions, so FOOTPRINT is a generic figure per
   * furniture type -- and a generated 3D model adds its own error on top. Letting the
   * owner correct a piece by eye is more honest than pretending the stored size is right.
   *
   * Clamped to the range the saved-room format accepts (roomItemSchema.scale), so a piece
   * can never be resized into a layout that is rejected on save.
   */
  const resize = useCallback(
    (id: string | null, by: number) =>
      id &&
      setItems((xs) =>
        xs.map((it) =>
          it.id === id ? { ...it, scale: Math.min(4, Math.max(0.25, (it.scale ?? 1) * by)) } : it,
        ),
      ),
    [],
  );
  /**
   * Turn a piece to an exact angle.
   *
   * The Rotate button steps 45 degrees, which covers a full circle in eight presses but
   * can never reach an angle between the steps -- no sofa set at 20 degrees to the wall,
   * no chair turned slightly towards the room. This takes any angle in the full 360.
   */
  const setRotation = useCallback(
    (id: string | null, degrees: number) =>
      id && setItems((xs) => xs.map((it) => (it.id === id ? { ...it, rot: (degrees * Math.PI) / 180 } : it))),
    [],
  );
  const remove = useCallback((id: string | null) => {
    if (!id) return;
    setItems((xs) => xs.filter((it) => it.id !== id));
    setSelected(null);
  }, []);
  /**
   * Empty the room, in two taps.
   *
   * This throws away everything the owner arranged and there is no undo, so a single
   * click is too easy to hit by accident -- the button sits next to Remove, which is a
   * one-piece action. The second tap is the confirmation; it lapses after a few seconds
   * so the toolbar never sits in a primed state waiting to catch someone out.
   */
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  useEffect(() => {
    if (!confirmEmpty) return;
    const t = setTimeout(() => setConfirmEmpty(false), 4000);
    return () => clearTimeout(t);
  }, [confirmEmpty]);
  const emptyRoom = () => {
    if (!confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setItems([]);
    setSelected(null);
    setConfirmEmpty(false);
  };

  const duplicate = (id: string | null) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const copy = { ...it, id: uid(), x: clampX(it.x + 0.5), z: clampZ(it.z + 0.5) };
    setItems((xs) => [...xs, copy]);
    setSelected(copy.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "r" || e.key === "R") rotate(selected);
      if (e.key === "Delete" || e.key === "Backspace") remove(selected);
      if (e.key === "+" || e.key === "=") resize(selected, SCALE_STEP);
      if (e.key === "-" || e.key === "_") resize(selected, 1 / SCALE_STEP);
      if (e.key === "Escape") {
        setSelected(null);
        setConfirmEmpty(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, rotate, remove, resize]);

  async function addRoomToCart() {
    const counts = new Map<string, number>();
    for (const it of items) {
      const p = productOf(it);
      if (p) counts.set(p.slug, (counts.get(p.slug) ?? 0) + 1);
    }
    const lines = [...counts].map(([slug, quantity]) => ({
      productSlug: slug,
      quantity: Math.min(20, quantity),
      variant: "",
      config: { fabric: "", wood: "", metal: "" },
    }));
    if (lines.length) await addToCart(lines);
  }

  async function save() {
    setStatus("Saving…");
    const body = JSON.stringify({ name, layout: items, style: { wall, floor, mode, shell } });

    // The edit token proves this browser is the one that saved the room. Only rooms we
    // hold a token for are updated in place; anything else (someone else's shared link,
    // or a room saved before tokens existed) is saved as a new copy of our own, which is
    // why the method is chosen by the token and not just by having an id.
    const token = roomId ? editTokenFor(roomId) : null;
    const updating = Boolean(roomId && token);

    const res = await fetch(updating ? `/api/rooms/${roomId}` : "/api/rooms", {
      method: updating ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(updating && token ? { "x-room-token": token } : {}),
      },
      body,
    }).catch(() => null);
    if (!res?.ok) {
      const problem = await res?.json().catch(() => null);
      return setStatus(problem?.error ?? "Couldn't save. Please try again.");
    }
    const { room, editToken } = await res.json();
    if (editToken) rememberEditToken(room.id, editToken);
    setRoomId(room.id);
    setCanEditRoom(Boolean(editTokenFor(room.id)));
    router.replace(`/planner?room=${room.id}`, { scroll: false });
    const link = `${window.location.origin}/planner?room=${room.id}`;
    const copied = await navigator.clipboard
      ?.writeText(link)
      .then(() => true)
      .catch(() => false);
    setStatus(copied ? "Saved. Share link copied to clipboard." : `Saved. Share this link: ${link}`);
  }

  return (
    <main className="planner" ref={plannerRef} data-resizing={side.dragging ? "" : undefined}>
      {/* data-lenis-prevent: let this panel scroll natively instead of the page's smooth scroll */}
      <aside className="planner-side" data-lenis-prevent>
        <div>
          <p className="label">Room planner</p>
          <h1>Arrange your room</h1>
        </div>
        <label>
          <p className="label">Room name</p>
          <input
            className="palette-item"
            style={{ width: "100%", cursor: "text" }}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div>
          <p className="label">Start from a room</p>
          <div className="chips preset-chips">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button key={key} className="chip" onClick={() => applyPreset(key)}>
                {p.name.replace("My ", "").replace(/^./, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
        <div className="room-style">
          <p className="label">Room</p>
          <div className="chips wrap" role="group" aria-label="Room">
            {SHELLS.map((o) => (
              <button key={o.key} className={`chip ${shell === o.key ? "on" : ""}`} onClick={() => setShell(o.key)}>
                {o.name}
              </button>
            ))}
          </div>
          <p className="label">Wall colour</p>
          <div className="swatch-row" role="group" aria-label="Wall colour">
            {WALLS.map((c) => (
              <button
                key={c.hex}
                className="swatch sm"
                style={{ "--c": c.hex } as React.CSSProperties}
                aria-pressed={wall === c.hex}
                aria-label={`${c.name} walls`}
                title={c.name}
                onClick={() => setWall(c.hex)}
              />
            ))}
          </div>
          <p className="label">Floor</p>
          <div className="chips wrap" role="group" aria-label="Floor">
            {FLOORS.map((f) => (
              <button key={f.key} className={`chip ${floor === f.key ? "on" : ""}`} onClick={() => setFloor(f.key)}>
                <i className="floor-dot" style={{ background: f.hex }} /> {f.name}
              </button>
            ))}
          </div>
          <p className="label">Show furniture as</p>
          <div className="chips wrap" role="group" aria-label="Furniture display">
            {AI_MODELS && (
              <button className={`chip ${mode === "ai" ? "on" : ""}`} onClick={() => setMode("ai")}>
                ✨ AI 3D (real shape)
              </button>
            )}
            <button className={`chip ${mode === "photo" ? "on" : ""}`} onClick={() => setMode("photo")}>
              Product photos
            </button>
            <button className={`chip ${mode === "simple" ? "on" : ""}`} onClick={() => setMode("simple")}>
              Simple 3D
            </button>
          </div>
          {AI_MODELS && (
            <p className="hint">
              &ldquo;AI 3D&rdquo; turns each product&apos;s photo into a real 3D model of that exact piece (made once, then
              instant for everyone). Pieces that do not have one yet are shown as simple 3D shapes, so everything in
              the room stays solid from every angle. Choose &ldquo;Product photos&rdquo; to see the photographs instead.
            </p>
          )}
        </div>
        <div>
          <p className="label">Add a piece</p>
          {GROUPS.map((g) => {
            const list = products.filter((p) => groupOf(p) === g.key);
            if (!list.length) return null;
            return (
              <details key={g.key} className="palette-group" open={g.key === startPreset}>
                <summary>
                  {g.name} <span>{list.length}</span>
                </summary>
                <div className="palette-list">
                  {list.map((p) => (
                    <button key={p.slug} className="palette-item" onClick={() => add(p)}>
                      {/* 300px: a card is ~250px wide at the widest panel, and ~140px at the
                          default, so this still looks sharp on a 2x screen. */}
                      {p.image && <img src={shopifyImage(p.image, 300)} alt="" loading="lazy" />}
                      <span className="palette-name">{p.name}</span>
                      <small>
                        <span className="palette-kind">{p.kind ? KIND_LABEL[p.kind] : ""}</span>
                        <b>{formatPrice(p.priceCents)}</b>
                      </small>
                    </button>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <p className="hint">
          Drag pieces to move them, inside the room or outside it. Drag empty floor to orbit, scroll to zoom.{" "}
          <b>R</b> rotates, <b>+</b>/<b>−</b> resize, <b>Delete</b> removes.
        </p>
        <div className="total">
          <span className="label" style={{ margin: 0 }}>
            {items.length} pieces
          </span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <button className="btn solid wide" onClick={addRoomToCart} disabled={busy || items.length === 0}>
          {busy ? "Adding…" : `Add room to basket · ${formatPrice(total)}`}
        </button>
        <button className="btn wide" onClick={save}>
          {roomId && canEditRoom ? "Save changes" : "Save & get share link"}
        </button>
        {(() => {
          const loading = roomParam && roomParam !== roomId;
          const msg =
            loadFailed === roomParam && loading
              ? "That room link doesn't exist any more."
              : loading
                ? "Loading room…"
                : status;
          return msg && <p className="hint">{msg}</p>;
        })()}
      </aside>

      {/* Hidden by CSS on the stacked layout, which also drops it out of the tab order. */}
      <div
        className="planner-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Panel width"
        aria-valuenow={side.width}
        aria-valuemin={SIDE_W.min}
        aria-valuemax={SIDE_W.max}
        tabIndex={0}
        title="Drag to resize \u00b7 double-click to reset"
        onPointerDown={side.onPointerDown}
        onKeyDown={side.onKeyDown}
        onDoubleClick={side.onDoubleClick}
      />

      <div className="planner-stage" ref={setTrack} data-lenis-prevent>
        <View style={{ position: "absolute", inset: 0 }}>
          {track && (
            <PlannerScene
              items={items}
              productOf={productOf}
              mode={mode}
              wall={wall}
              floor={floor}
              shell={shell}
              selected={selected}
              hour={hour}
              track={track}
              onSelect={setSelected}
              onMove={(id, x, z) => setItems((xs) => xs.map((it) => (it.id === id ? { ...it, x, z } : it)))}
            />
          )}
        </View>

        {added && (
          <div className="planner-added" key={added.at} role="status">
            {added.image && <img src={shopifyImage(added.image, 120)} alt="" />}
            <span>
              <strong>✓ Added to your room</strong>
              {added.name}
              {added.replaced > 0 && <small> · replaced {added.replaced} similar piece{added.replaced > 1 ? "s" : ""}</small>}
            </span>
          </div>
        )}
        <div className="planner-toolbar">
          <button disabled={!selected} onClick={() => rotate(selected)}>
            ⟲ Rotate
          </button>
          <button disabled={!selected} onClick={() => resize(selected, 1 / SCALE_STEP)} aria-label="Make smaller">
            − Smaller
          </button>
          <button disabled={!selected} onClick={() => resize(selected, SCALE_STEP)} aria-label="Make bigger">
            + Bigger
          </button>
          <button disabled={!selected} onClick={() => duplicate(selected)}>
            Duplicate
          </button>
          <button disabled={!selected} onClick={() => remove(selected)}>
            Remove
          </button>
          <button
            className={confirmEmpty ? "danger" : undefined}
            disabled={items.length === 0}
            onClick={emptyRoom}
          >
            {confirmEmpty ? `Remove all ${items.length}?` : "Empty room"}
          </button>
        </div>

        {selectedItem && (
          <div className="planner-rotate">
            <div>
              <span>Turn this piece</span>
              <span>{Math.round(selectedAngle)}&deg;</span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(selectedAngle)}
              aria-label="Turn this piece"
              onChange={(e) => setRotation(selected, +e.target.value)}
            />
          </div>
        )}

        <div className="planner-time">
          <div>
            <span>Time of day</span>
            <span>{formatHour(hour)}</span>
          </div>
          <input type="range" min={6} max={22} step={0.05} value={hour} onChange={(e) => setHour(+e.target.value)} />
        </div>
      </div>
    </main>
  );
}
