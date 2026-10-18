"use client";

import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCart } from "@/components/commerce/CartProvider";
import { formatPrice, type Palette, type Product, type RoomItem } from "@/lib/types";
import { daylightAt, formatHour } from "@/three/daylight";
import { ROOMS } from "@/lib/catalog-data";
import { FOOTPRINT, KIND_LABEL, ROLES_FOR, STACKABLE, SURFACE, type FurnitureKind } from "@/three/furniture";
import { Furniture } from "@/three/Furniture";
import { getProceduralTextures } from "@/three/materials";
import { SceneLights } from "@/three/SceneLights";

const ROOM = { w: 6, d: 5 };
const SNAP = 0.05;
const PALETTE: Palette = { fabric: "#e8e0d2", wood: "#d2b48c", metal: "#2b2b2b" };
// catalogue slugs matching PALETTE, used when the room goes into the cart
const PALETTE_SLUGS = { fabric: "boucle-ivory", wood: "white-oak", metal: "black-steel" } as const;

const uid = () => Math.random().toString(36).slice(2, 10);
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clampX = (v: number) => Math.min(ROOM.w / 2 - 0.2, Math.max(-ROOM.w / 2 + 0.2, v));
const clampZ = (v: number) => Math.min(ROOM.d / 2 - 0.2, Math.max(-ROOM.d / 2 + 0.2, v));

const PI = Math.PI;
type Spot = [FurnitureKind, number, number, number?];
// Ready-made layouts. Back wall is z = -2.5, left wall x = -3. A chair's seat faces +z at rot 0.
const PRESETS: Record<string, { name: string; spots: Spot[] }> = {
  living: {
    name: "My living room",
    spots: [
      ["rug", 0, -0.7, PI / 2], ["sofa", 0, -1.75], ["coffeeTable", 0, -0.55], ["armchair", -1.75, -0.45, 1.2],
      ["sideTable", -1.4, -2.0], ["floorLamp", 1.45, -2.1], ["mediaConsole", 0, 2.0, PI], ["bookshelf", -2.78, 1.2, PI / 2],
    ],
  },
  bedroom: {
    name: "My bedroom",
    spots: [
      ["rug", 0, -0.4, PI / 2], ["bed", 0, -1.35], ["nightstand", -1.2, -2.25], ["nightstand", 1.2, -2.25],
      ["tableLamp", -1.2, -2.25], ["tableLamp", 1.2, -2.25], ["bench", 0, 0.05], ["dresser", -2.7, 0.3, PI / 2],
      ["wardrobe", 2.62, -1.3, -PI / 2], ["mirror", -2.72, -1.6, PI / 2],
    ],
  },
  dining: {
    name: "My dining room",
    spots: [
      ["rug", 0, 0, PI / 2], ["diningTable", 0, 0],
      ["diningChair", -0.45, 0.62, PI], ["diningChair", 0.45, 0.62, PI], ["diningChair", -0.45, -0.62], ["diningChair", 0.45, -0.62],
      ["diningChair", 1.12, 0, -PI / 2], ["diningChair", -1.12, 0, PI / 2], ["sideboard", 0, -2.22], ["floorLamp", 2.5, -2.15],
    ],
  },
  office: {
    name: "My home office",
    spots: [
      ["rug", 0, -1.1, PI / 2], ["desk", 0, -2.1], ["officeChair", 0.1, -1.45, PI], ["tableLamp", -0.5, -2.25],
      ["bookshelf", -2.78, -1.2, PI / 2], ["armchair", 1.9, -0.6, -2.2], ["floorLamp", 2.55, -1.4],
    ],
  },
};
const presetItems = (key: string): RoomItem[] =>
  (PRESETS[key] ?? PRESETS.living).spots.map(([kind, x, z, rot = 0]) => ({ id: uid(), kind, x, z, rot }));

/** Height a stackable item (a table lamp) should sit at: the top of any surface it is placed over. */
function standHeight(it: RoomItem, items: RoomItem[]) {
  if (!STACKABLE.includes(it.kind)) return 0;
  let y = 0;
  for (const o of items) {
    const top = SURFACE[o.kind];
    if (!top || o.id === it.id) continue;
    const [w, d] = FOOTPRINT[o.kind];
    const quarter = Math.round(o.rot / (PI / 2)) % 2 !== 0; // turned 90°: swap width/depth
    const hw = (quarter ? d : w) / 2;
    const hd = (quarter ? w : d) / 2;
    if (Math.abs(it.x - o.x) <= hw && Math.abs(it.z - o.z) <= hd) y = Math.max(y, top);
  }
  return y;
}

function Room() {
  const floorMap = useMemo(() => {
    const t = getProceduralTextures().wood.clone();
    t.repeat.set(3, 6);
    t.rotation = Math.PI / 2;
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorMap} color="#c9b08e" roughness={0.75} />
      </mesh>
      <gridHelper args={[ROOM.w, ROOM.w * 2, "#8a7457", "#8a7457"]} position-y={0.002} scale={[1, 1, ROOM.d / ROOM.w]}>
        <lineBasicMaterial attach="material" color="#5a4630" transparent opacity={0.12} />
      </gridHelper>
      {/* two walls so the light has something to land on */}
      <mesh position={[0, 1.3, -ROOM.d / 2 - 0.05]} receiveShadow castShadow>
        <boxGeometry args={[ROOM.w + 0.2, 2.6, 0.1]} />
        <meshStandardMaterial color="#efe9df" roughness={0.95} />
      </mesh>
      <mesh position={[-ROOM.w / 2 - 0.05, 1.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.1, 2.6, ROOM.d]} />
        <meshStandardMaterial color="#e9e2d6" roughness={0.95} />
      </mesh>
    </group>
  );
}

function PlannerScene({
  items,
  selected,
  hour,
  track,
  onSelect,
  onMove,
}: {
  items: RoomItem[];
  selected: string | null;
  hour: number;
  track: HTMLDivElement;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
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
      const hits = ray.intersectObjects([...groups.current.values()], true);
      if (!hits.length) return;
      let obj: THREE.Object3D | null = hits[0].object;
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
        maxDistance={16}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.4}
      />
      <SceneLights hour={() => hourRef.current} shadowSize={5} />
      <Room />
      {items.map((it) => {
        const [w, d] = FOOTPRINT[it.kind];
        return (
          <group
            key={it.id}
            position={[it.x, standHeight(it, items), it.z]}
            rotation-y={it.rot}
            userData={{ itemId: it.id }}
            ref={(g) => {
              if (g) groups.current.set(it.id, g);
              else groups.current.delete(it.id);
            }}
          >
            <Furniture kind={it.kind} palette={PALETTE} spread={0.6} glow={() => daylightAt(hourRef.current).glow} />
            {selected === it.id && (
              <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
                <planeGeometry args={[w + 0.16, d + 0.16]} />
                <meshBasicMaterial color="#b4532a" transparent opacity={0.28} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

export function Planner({ products }: { products: Product[] }) {
  const router = useRouter();
  const { add: addToCart, busy } = useCart();
  const params = useSearchParams();
  const roomParam = params.get("room");

  const startPreset = params.get("preset") ?? "living";
  const [items, setItems] = useState<RoomItem[]>(() => presetItems(startPreset));
  const [selected, setSelected] = useState<string | null>(null);
  const [hour, setHour] = useState(16);
  const [name, setName] = useState(() => (PRESETS[startPreset] ?? PRESETS.living).name);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);

  const priceOf = useMemo(() => new Map(products.map((p) => [p.kind, p])), [products]);
  const total = items.reduce((s, it) => s + (priceOf.get(it.kind)?.priceCents ?? 0), 0);

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
        setRoomId(room.id);
      })
      .catch(() => !cancelled && setLoadFailed(roomParam));
    return () => {
      cancelled = true;
    };
  }, [roomParam, roomId]);

  const applyPreset = (key: string) => {
    setItems(presetItems(key));
    setSelected(null);
    if (Object.values(PRESETS).some((p) => p.name === name)) setName(PRESETS[key].name);
  };

  const add = (kind: FurnitureKind) => {
    const id = uid();
    const n = items.length;
    setItems((xs) => [...xs, { id, kind, x: snap(((n * 0.7) % 3) - 1.2), z: snap(((n * 0.9) % 2.4) - 0.6), rot: 0 }]);
    setSelected(id);
  };
  const rotate = useCallback(
    (id: string | null) => id && setItems((xs) => xs.map((it) => (it.id === id ? { ...it, rot: it.rot - Math.PI / 4 } : it))),
    [],
  );
  const remove = useCallback((id: string | null) => {
    if (!id) return;
    setItems((xs) => xs.filter((it) => it.id !== id));
    setSelected(null);
  }, []);
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
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, rotate, remove]);

  async function addRoomToCart() {
    const counts = new Map<FurnitureKind, number>();
    for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
    const lines = [...counts].flatMap(([kind, quantity]) => {
      const p = priceOf.get(kind);
      if (!p) return [];
      const roles = ROLES_FOR[kind];
      const config = {
        fabric: roles.includes("fabric") ? PALETTE_SLUGS.fabric : "",
        wood: roles.includes("wood") ? PALETTE_SLUGS.wood : "",
        metal: roles.includes("metal") ? PALETTE_SLUGS.metal : "",
      };
      return [{ productSlug: p.slug, quantity: Math.min(20, quantity), config }];
    });
    if (lines.length) await addToCart(lines);
  }

  async function save() {
    setStatus("Saving…");
    const body = JSON.stringify({ name, layout: items });
    const res = await fetch(roomId ? `/api/rooms/${roomId}` : "/api/rooms", {
      method: roomId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => null);
    if (!res?.ok) return setStatus("Couldn't save. Please try again.");
    const { room } = await res.json();
    setRoomId(room.id);
    router.replace(`/planner?room=${room.id}`, { scroll: false });
    const link = `${window.location.origin}/planner?room=${room.id}`;
    const copied = await navigator.clipboard
      ?.writeText(link)
      .then(() => true)
      .catch(() => false);
    setStatus(copied ? "Saved. Share link copied to clipboard." : `Saved. Share this link: ${link}`);
  }

  return (
    <main className="planner">
      <aside className="planner-side">
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
            {ROOMS.map((r) => (
              <button key={r.slug} className="chip" onClick={() => applyPreset(r.slug)}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Add a piece</p>
          {ROOMS.map((r) => (
            <details key={r.slug} className="palette-group" open={r.slug === startPreset}>
              <summary>
                {r.name} <span>{products.filter((p) => p.rooms[0] === r.slug).length}</span>
              </summary>
              <div className="palette-list">
                {products
                  .filter((p) => p.rooms[0] === r.slug)
                  .map((p) => (
                    <button key={p.slug} className="palette-item" onClick={() => add(p.kind)}>
                      {p.name}
                      <small>
                        {KIND_LABEL[p.kind]} · {formatPrice(p.priceCents)}
                      </small>
                    </button>
                  ))}
              </div>
            </details>
          ))}
        </div>
        <p className="hint">
          Drag pieces to move them. Drag empty floor to orbit, scroll to zoom. <b>R</b> rotates, <b>Delete</b> removes.
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
          {roomId ? "Save changes" : "Save & get share link"}
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

      <div className="planner-stage" ref={setTrack} data-lenis-prevent>
        <View style={{ position: "absolute", inset: 0 }}>
          {track && (
            <PlannerScene
              items={items}
              selected={selected}
              hour={hour}
              track={track}
              onSelect={setSelected}
              onMove={(id, x, z) => setItems((xs) => xs.map((it) => (it.id === id ? { ...it, x, z } : it)))}
            />
          )}
        </View>

        <div className="planner-toolbar">
          <button disabled={!selected} onClick={() => rotate(selected)}>
            ⟲ Rotate
          </button>
          <button disabled={!selected} onClick={() => duplicate(selected)}>
            Duplicate
          </button>
          <button disabled={!selected} onClick={() => remove(selected)}>
            Remove
          </button>
        </div>

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
