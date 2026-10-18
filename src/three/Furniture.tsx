"use client";

import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Palette } from "@/lib/types";
import { FURNITURE, type FurnitureKind, type Part, type PartRole } from "./furniture";
import { createFurnitureMaterial, createRevealDepthMaterial, getProceduralTextures } from "./materials";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Deterministic pseudo-random so the explosion looks the same every time.
const rand = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function buildGeometry(p: Part) {
  if (p.shape === "box") {
    const [w, h, d] = p.size;
    return new RoundedBoxGeometry(w, h, d, 4, Math.min(p.radius ?? 0.01, Math.min(w, h, d) / 2 - 1e-4));
  }
  if (p.shape === "cyl") {
    const [rt, rb, h] = p.size;
    return new THREE.CylinderGeometry(rt, rb, h, 48, 1, false);
  }
  return new THREE.SphereGeometry(p.size[0], 32, 16);
}

function buildEdges(p: Part) {
  // Sharp-edged proxy so the blueprint reads as clean technical lines.
  const g =
    p.shape === "box"
      ? new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2])
      : p.shape === "cyl"
        ? new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], 24)
        : new THREE.IcosahedronGeometry(p.size[0], 1);
  const e = new THREE.EdgesGeometry(g, 30);
  g.dispose();
  return e;
}

export type FurnitureProps = {
  kind: FurnitureKind;
  palette: Palette;
  /** Read every frame. 0 = exploded blueprint, 1 = fully built. Omit to auto-assemble on mount. */
  assembly?: () => number;
  /** Seconds before auto-assembly starts. */
  delay?: number;
  /** 0..1 evening glow for lamps. */
  glow?: () => number;
  /** Read every frame. 0..1 pulls the finished, solid piece apart (exploded view). */
  explode?: () => number;
  /** Extra explosion distance multiplier. */
  spread?: number;
  castShadow?: boolean;
  /** Hide entirely (no blueprint lines) while assembly is 0. */
  hideWhenUnbuilt?: boolean;
} & Omit<ThreeElements["group"], "children">;

export function Furniture({
  kind,
  palette,
  assembly,
  explode,
  delay = 0,
  glow,
  spread = 1,
  castShadow = true,
  hideWhenUnbuilt = false,
  ...groupProps
}: FurnitureProps) {
  const parts = FURNITURE[kind];
  const bulb = parts.find((p) => p.role === "bulb");
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lineRefs = useRef<(THREE.LineSegments | null)[]>([]);
  const start = useRef<number | null>(null);
  const lampLight = useRef<THREE.PointLight>(null);
  const root = useRef<THREE.Group>(null);

  const reveal = useMemo(() => ({ uReveal: { value: 0 } }), []);

  const { geometries, edges, offsets } = useMemo(() => {
    const geometries = parts.map(buildGeometry);
    const edges = parts.map(buildEdges);
    const offsets = parts.map((p, i) => {
      const dir = new THREE.Vector3(p.pos[0], p.pos[1] - 0.35, p.pos[2]);
      if (dir.lengthSq() < 1e-4) dir.set(rand(i, 1) - 0.5, 0.4, rand(i, 2) - 0.5);
      dir.normalize();
      const dist = (0.9 + rand(i, 3) * 1.1) * spread;
      return {
        pos: dir.multiplyScalar(dist).add(new THREE.Vector3(0, (0.3 + rand(i, 4) * 0.9) * spread, 0)),
        rot: new THREE.Euler((rand(i, 5) - 0.5) * 2.4, (rand(i, 6) - 0.5) * 2.4, (rand(i, 7) - 0.5) * 2.4),
      };
    });
    return { geometries, edges, offsets };
  }, [parts, spread]);

  const textures = useMemo(() => getProceduralTextures(), []);

  // One material per role (plus per-colour books), shared by that role's parts.
  const mats = useMemo(() => {
    const byRole = new Map<string, ReturnType<typeof createFurnitureMaterial>>();
    const colorFor = (role: PartRole, p: Part) =>
      p.color ??
      (role === "fabric"
        ? palette.fabric
        : role === "accent"
          ? accentFor(palette.fabric)
          : role === "wood"
            ? palette.wood
            : role === "metal"
              ? palette.metal
              : role === "shade"
                ? "#efe6d6"
                : role === "mirror"
                  ? "#c7d2d8"
                  : "#ffffff");
    // fixed-colour parts get their own material so palette changes skip them
    const keys = parts.map((p) => (p.color ? `${p.role}-${p.color}` : p.role));
    parts.forEach((p, i) => {
      if (!byRole.has(keys[i])) byRole.set(keys[i], createFurnitureMaterial(p.role, reveal, textures, colorFor(p.role, p)));
    });
    return { byRole, keys };
    // palette changes are animated below, not rebuilt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, reveal, textures]);

  const depthMat = useMemo(() => createRevealDepthMaterial(reveal), [reveal]);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#8fd3ff", transparent: true, opacity: 1, depthWrite: false }),
    [],
  );

  // Animate colour changes with the morph shader.
  useEffect(() => {
    const targets: Record<string, string> = {
      fabric: palette.fabric,
      accent: accentFor(palette.fabric),
      wood: palette.wood,
      metal: palette.metal,
    };
    for (const [key, m] of mats.byRole) {
      const next = targets[key];
      if (!next) continue;
      const nextColor = new THREE.Color(next);
      if (nextColor.equals(m.uniforms.uTo.value)) continue;
      // start from whatever is currently most visible
      m.uniforms.uFrom.value.copy(m.uniforms.uMix.value > 0.5 ? m.uniforms.uTo.value : m.uniforms.uFrom.value);
      m.uniforms.uTo.value.copy(nextColor);
      m.uniforms.uMix.value = 0;
      m.uniforms.uSeed.value = Math.random() * 10;
    }
  }, [palette.fabric, palette.wood, palette.metal, mats]);

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      edges.forEach((g) => g.dispose());
      mats.byRole.forEach((m) => m.material.dispose());
      depthMat.dispose();
      lineMat.dispose();
    },
    [geometries, edges, mats, depthMat, lineMat],
  );

  useFrame((state, dt) => {
    let p: number;
    if (assembly) p = assembly();
    else {
      if (start.current === null) start.current = state.clock.elapsedTime + delay;
      p = Math.min(1, Math.max(0, (state.clock.elapsedTime - start.current) / 2.2));
    }

    if (root.current) root.current.visible = !hideWhenUnbuilt || p > 0.001;
    const ex = explode?.() ?? 0;
    const n = parts.length;
    const stagger = 0.5 / n;
    for (let i = 0; i < n; i++) {
      const mesh = meshRefs.current[i];
      const line = lineRefs.current[i];
      if (!mesh || !line) continue;
      // parts settle in order: lower parts first (legs, frame), cushions last
      const local = easeOutCubic(smooth(i * stagger, i * stagger + 0.5, p));
      // exploded view: parts slide out along their own direction, barely rotating
      const inv = 1 - local + ex * 0.3;
      const rinv = 1 - local + ex * 0.05;
      const base = parts[i];
      const o = offsets[i];
      mesh.position.set(base.pos[0] + o.pos.x * inv, base.pos[1] + o.pos.y * inv, base.pos[2] + o.pos.z * inv);
      const r = base.rot ?? [0, 0, 0];
      mesh.rotation.set(r[0] + o.rot.x * rinv, r[1] + o.rot.y * rinv, r[2] + o.rot.z * rinv);
      line.position.copy(mesh.position);
      line.rotation.copy(mesh.rotation);
    }

    reveal.uReveal.value = smooth(0.45, 1, p);
    lineMat.opacity = 1 - smooth(0.7, 1, p);
    lineMat.visible = lineMat.opacity > 0.01;

    for (const m of mats.byRole.values()) {
      if (m.uniforms.uMix.value < 1) m.uniforms.uMix.value = Math.min(1, m.uniforms.uMix.value + dt / 1.4);
    }

    if (bulb) {
      const g = (glow?.() ?? 0) * reveal.uReveal.value;
      const shade = mats.byRole.get("shade")?.material as THREE.MeshPhysicalMaterial | undefined;
      if (shade) shade.emissiveIntensity = g * 2.6;
      // table lamps are smaller and closer to things, so they glow softer
      if (lampLight.current) lampLight.current.intensity = g * (bulb.pos[1] > 1 ? 16 : 6);
    }
  });

  return (
    <group ref={root} {...groupProps}>
      {parts.map((p, i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              meshRefs.current[i] = m;
            }}
            geometry={geometries[i]}
            material={mats.byRole.get(mats.keys[i])!.material}
            customDepthMaterial={depthMat}
            castShadow={castShadow && p.role !== "bulb"}
            receiveShadow
          />
          <lineSegments
            ref={(l) => {
              lineRefs.current[i] = l;
            }}
            geometry={edges[i]}
            material={lineMat}
          />
        </group>
      ))}
      {bulb && (
        <pointLight
          ref={lampLight}
          position={[bulb.pos[0], bulb.pos[1] - 0.08, bulb.pos[2]]}
          color="#ffad5c"
          intensity={0}
          distance={7}
          decay={1.4}
        />
      )}
    </group>
  );
}

/** Accent cushions: a deeper tone of the main fabric. */
function accentFor(hex: string) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + 0.03) % 1, Math.min(1, hsl.s * 1.15 + 0.05), hsl.l > 0.5 ? hsl.l - 0.22 : hsl.l + 0.16);
  return `#${c.getHexString()}`;
}
