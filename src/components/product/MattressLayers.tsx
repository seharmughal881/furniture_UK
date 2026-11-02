"use client";

import { OrbitControls, PerspectiveCamera, RoundedBox, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mattressLayers, type Layer } from "@/lib/mattress";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

// A showroom-style cut sample of the mattress (metres), its height exaggerated so thin layers read.
const W = 1.3;
const D = 0.9;
const HEIGHT = 0.42;
const GAP = 0.085;
const PITCH = 0.13;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

/** Fabric with diamond quilting and stitch dots. */
const quilt = (colour: string) =>
  canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = colour;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "rgba(0,0,0,0.13)";
      g.lineWidth = 3;
      for (let i = -s; i <= s * 2; i += s / 4) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + s, s);
        g.moveTo(i, s);
        g.lineTo(i + s, 0);
        g.stroke();
      }
    },
    [W / 0.3, D / 0.3],
  );

/** Foam: fine pores; bonded foam: the familiar multi-coloured speckles. */
const foam = (colour: string, bonded: boolean) =>
  canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = colour;
      g.fillRect(0, 0, s, s);
      const bits = bonded ? ["#8f8a80", "#cfc8b8", "#7d8ea3", "#c9b27a", "#b98b8b", "#e8e3d8"] : ["rgba(0,0,0,0.06)", "rgba(255,255,255,0.35)"];
      for (let i = 0; i < (bonded ? 900 : 1600); i++) {
        g.fillStyle = bits[i % bits.length];
        const r = bonded ? 2 + ((i * 7) % 6) : 1 + (i % 2);
        g.fillRect((i * 97) % s, (i * 61 + ((i * i) % 37)) % s, r, r);
      }
    },
    [2, 2],
  );

/** One spring as a tube: hourglass (Bonnell) or straight (pocket), built at real size. */
function coilGeometry(height: number, radius: number, hourglass: boolean) {
  class Coil extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = t * Math.PI * 2 * 5;
      const r = hourglass ? radius * (0.55 + 0.45 * Math.abs(2 * t - 1) ** 1.3) : radius;
      return target.set(Math.cos(a) * r, (t - 0.5) * height, Math.sin(a) * r);
    }
  }
  return new THREE.TubeGeometry(new Coil(), 140, 0.0045, 5, false);
}

function grid() {
  const cols = Math.floor((W - 0.04) / PITCH);
  const rows = Math.floor((D - 0.04) / PITCH);
  const out: [number, number][] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) out.push([(i - (cols - 1) / 2) * PITCH, (j - (rows - 1) / 2) * PITCH]);
  return out;
}

function Springs({ h, pocket, dim }: { h: number; pocket: boolean; dim: boolean }) {
  const spots = useMemo(() => grid(), []);
  const coil = useMemo(() => coilGeometry(h * 0.94, PITCH * (pocket ? 0.33 : 0.46), !pocket), [h, pocket]);
  const pocketGeo = useMemo(() => new THREE.CylinderGeometry(PITCH * 0.47, PITCH * 0.47, h, 20), [h]);
  const coils = useRef<THREE.InstancedMesh>(null);
  const pockets = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], n) => {
      m.makeTranslation(x, 0, z);
      coils.current?.setMatrixAt(n, m);
      pockets.current?.setMatrixAt(n, m);
    });
    if (coils.current) coils.current.instanceMatrix.needsUpdate = true;
    if (pockets.current) pockets.current.instanceMatrix.needsUpdate = true;
  }, [spots, pocket]);
  useEffect(
    () => () => {
      coil.dispose();
      pocketGeo.dispose();
    },
    [coil, pocketGeo],
  );
  return (
    <group>
      <instancedMesh ref={coils} args={[coil, undefined, spots.length]} castShadow>
        <meshStandardMaterial key={String(dim)} color="#8d949b" metalness={0.85} roughness={0.32} transparent={dim} opacity={dim ? 0.25 : 1} />
      </instancedMesh>
      {pocket && (
        <instancedMesh ref={pockets} args={[pocketGeo, undefined, spots.length]}>
          <meshStandardMaterial key={String(dim)} color="#efebe3" roughness={0.95} transparent opacity={dim ? 0.12 : 0.5} depthWrite={false} />
        </instancedMesh>
      )}
      {!pocket &&
        // Bonnell units are held by a steel border rod at the top and bottom
        [-1, 1].map((s) => (
          <group key={s} position={[0, s * h * 0.47, 0]}>
            {(
              [
                [0, D / 2 - 0.015, W - 0.03, 0.008],
                [0, -D / 2 + 0.015, W - 0.03, 0.008],
                [W / 2 - 0.015, 0, 0.008, D - 0.03],
                [-W / 2 + 0.015, 0, 0.008, D - 0.03],
              ] as const
            ).map(([x, z, w, d], n) => (
              <mesh key={n} position={[x, 0, z]}>
                <boxGeometry args={[w, 0.008, d]} />
                <meshStandardMaterial key={String(dim)} color="#8d949b" metalness={0.85} roughness={0.3} transparent={dim} opacity={dim ? 0.25 : 1} />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
}

function LayerMesh({ layer, h, dim }: { layer: Layer; h: number; dim: boolean }) {
  const map = useMemo(
    () =>
      layer.kind === "cover" || layer.kind === "top"
        ? quilt(layer.colour)
        : layer.kind === "comfort" || layer.kind === "base" || layer.kind === "foamCore"
          ? foam(layer.colour, layer.name.includes("medical"))
          : null,
    [layer],
  );
  useEffect(() => () => map?.dispose(), [map]);
  if (layer.kind === "bonnell" || layer.kind === "pocket") return <Springs h={h} pocket={layer.kind === "pocket"} dim={dim} />;
  return (
    <RoundedBox args={[W, h, D]} radius={Math.min(h / 2.2, layer.kind === "top" ? 0.05 : 0.018)} smoothness={4} castShadow receiveShadow>
      <meshStandardMaterial key={String(dim)} map={map} roughness={0.92} transparent={dim} opacity={dim ? 0.2 : 1} />
    </RoundedBox>
  );
}

/** Numbered badge that always faces the camera, matching the list beside the view. */
function Badge({ n, active }: { n: number; active: boolean }) {
  const tex = useMemo(
    () =>
      canvasTexture(
        96,
        (g, s) => {
          g.fillStyle = active ? "#c8102e" : "#111";
          g.beginPath();
          g.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#fff";
          g.font = "bold 50px system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(String(n), s / 2, s / 2 + 3);
        },
        [1, 1],
      ),
    [n, active],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite scale={0.075} position={[W / 2 + 0.1, 0, 0]}>
      <spriteMaterial map={tex} depthTest={false} />
    </sprite>
  );
}

function Stack({ layers, total, explode, active }: { layers: Layer[]; total: number; explode: React.RefObject<number>; active: number | null }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const heights = layers.map((l) => (l.cm / total) * HEIGHT);
  const shown = useRef(0);
  useFrame((_, dt) => {
    shown.current += (explode.current - shown.current) * (1 - Math.exp(-dt * 4));
    // bottom layer on the floor, each one above it lifted by an extra gap as the sample opens
    let y = 0;
    for (let i = layers.length - 1; i >= 0; i--) {
      const g = groups.current[i];
      const k = layers.length - 1 - i;
      if (g) g.position.y = y + heights[i] / 2 + k * GAP * shown.current;
      y += heights[i];
    }
  });
  return (
    <>
      {layers.map((l, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)}>
          <LayerMesh layer={l} h={heights[i]} dim={active !== null && active !== i} />
          <Badge n={i + 1} active={active === i} />
        </group>
      ))}
    </>
  );
}

const TARGET = new THREE.Vector3(0, 0.42, 0);
const VIEW_DIR = new THREE.Vector3(1.75, 0.73, 2.35).normalize();

/**
 * Moves the camera back on narrow (phone) screens so the whole sample and its badges fit.
 * The aspect is the stage's own: inside a View, useThree's size is the whole page canvas.
 */
function FitCamera({ aspect }: { aspect: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.copy(VIEW_DIR).multiplyScalar(3.05 * Math.max(1, 1.3 / aspect)).add(TARGET);
    camera.lookAt(TARGET);
  }, [camera, aspect]);
  return null;
}

/** Mattress product view: the layers it is made of, separated in 3D, with a numbered list. */
export function MattressLayers({ name, description }: { name: string; description: string }) {
  const build = useMemo(() => mattressLayers(name, description), [name, description]);
  const total = build.layers.reduce((s, l) => s + l.cm, 0);
  const [open, setOpen] = useState(1);
  const [active, setActive] = useState<number | null>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const [aspect, setAspect] = useState(1.6);
  useEffect(() => {
    if (!trackEl) return;
    const ro = new ResizeObserver(([e]) => setAspect(e.contentRect.width / Math.max(e.contentRect.height, 1)));
    ro.observe(trackEl);
    return () => ro.disconnect();
  }, [trackEl]);
  const explode = useRef(0);
  const opened = useRef(false);
  // starts as a closed mattress and opens up shortly after it appears; then follows the slider
  useEffect(() => {
    if (opened.current) {
      explode.current = open;
      return;
    }
    const t = setTimeout(() => {
      opened.current = true;
      explode.current = open;
    }, 700);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div className="layers">
      <div className="layers-stage" ref={setTrackEl}>
        <View style={{ position: "absolute", inset: 0 }}>
          <PerspectiveCamera makeDefault fov={30} />
          <FitCamera aspect={aspect} />
          {trackEl && (
            <OrbitControls
              domElement={trackEl}
              target={[0, 0.42, 0]}
              enablePan={false}
              enableZoom={false}
              enableDamping
              minPolarAngle={0.5}
              maxPolarAngle={Math.PI / 2.1}
              autoRotate={active === null}
              autoRotateSpeed={0.5}
            />
          )}
          <SceneLights hour={() => 14} shadowSize={2.4} shadowMap={1024} />
          <ShadowFloor opacity={0.28} />
          <Stack layers={build.layers} total={total} explode={explode} active={active} />
        </View>
      </div>
      <label className="layers-slider">
        Separate layers
        <input type="range" min={0} max={1} step={0.01} value={open} onChange={(e) => setOpen(+e.target.value)} />
      </label>

      <div className="layers-list">
        <p className="layers-total">
          <strong>{build.totalCm ? `${build.totalCm} cm` : "Mattress"}</strong> · {build.layers.length} layers
        </p>
        <ol>
          {build.layers.map((l, i) => (
            <li key={i}>
              <button
                aria-pressed={active === i}
                onClick={() => setActive((a) => (a === i ? null : i))}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="n">{i + 1}</span>
                <i style={{ background: l.kind === "bonnell" || l.kind === "pocket" ? "#8d949b" : l.colour }} aria-hidden />
                <span className="t">
                  <b>{l.name}</b>
                  <small>{l.about}</small>
                </span>
                <span className="cm">≈ {l.cm} cm</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="hint">
          {build.totalCm ? "Total thickness is from the product name; " : ""}the thickness of each layer is approximate. Ask us on
          WhatsApp for the exact specification.
        </p>
      </div>
    </div>
  );
}
