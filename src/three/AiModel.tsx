"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type AiState =
  | { status: "ready"; url: string }
  | { status: "queued" }
  | { status: "failed"; error: string }
  | { status: "none" }
  | { status: "unavailable"; reason: string }
  | { status: "loading" };

// one request per product per page view, shared by every copy of it in the room
const states = new Map<string, Promise<AiState>>();
async function fetchState(slug: string, start: boolean): Promise<AiState> {
  const res = await fetch(`/api/models/${encodeURIComponent(slug)}`, { method: start ? "POST" : "GET" }).catch(() => null);
  return res?.ok ? res.json() : { status: "unavailable", reason: "network" };
}

/**
 * Asks the server for the product's AI 3D model and polls until it is ready.
 *
 * `start` controls whether a missing model is *ordered*. POSTing to /api/models/[slug]
 * begins a generation, which costs money once FAL_KEY is configured, so only the planner
 * -- where the visitor explicitly asked for "AI 3D" -- passes true. A product page just
 * reads what already exists; otherwise every visit to every product would quietly run up
 * a bill, and the daily cap would be spent by crawlers rather than customers.
 */
export function useAiModel(slug: string | undefined, enabled: boolean, start = true) {
  const [state, setState] = useState<AiState>({ status: "loading" });
  useEffect(() => {
    if (!slug || !enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async (first: boolean) => {
      let p = first ? states.get(slug) : undefined;
      if (!p) {
        p = fetchState(slug, first && start);
        if (first) states.set(slug, p);
      }
      const s = await p;
      if (!alive) return;
      setState(s);
      if (s.status === "queued") {
        states.delete(slug);
        timer = setTimeout(() => tick(false), 6000);
      }
    };
    tick(true);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slug, enabled, start]);
  return state;
}

/**
 * Generated meshes (TripoSR via trimesh) come with per-vertex colours only: no normals, no material,
 * and the colours are sRGB bytes that glTF readers treat as linear. Without normals the lighting
 * can't shade them, so they look dark and muddy. Fix that once per file; clones share the geometry.
 */
function prepare(scene: THREE.Group) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    if (!geo.attributes.normal) geo.computeVertexNormals();

    /*
     * A model that already has a texture keeps the material it shipped with.
     *
     * Everything below was written for TripoSR output, which is vertex colours and
     * nothing else. Replacing the material unconditionally also threw away the baked
     * texture of any model that had one -- a photoreal sofa arrived and rendered as a
     * flat grey blob. Models from models:attach / models:import are textured, so this
     * branch is now the common case.
     */
    const current = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (current && "map" in current && current.map) {
      current.side = THREE.DoubleSide;
      return;
    }

    const col = geo.attributes.color;
    if (col) {
      const c = new THREE.Color();
      const lin = new Float32Array(col.count * 3);
      for (let i = 0; i < col.count; i++) {
        c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.SRGBColorSpace);
        lin[i * 3] = c.r;
        lin[i * 3 + 1] = c.g;
        lin[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(lin, 3));
    }
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: !!col,
      roughness: 0.85,
      metalness: 0,
      // generated meshes can have flipped faces; draw both sides so nothing looks hollow
      side: THREE.DoubleSide,
    });
  });
  return scene;
}

const loaded = new Map<string, Promise<THREE.Group>>();
function loadGlb(url: string) {
  let p = loaded.get(url);
  if (!p) {
    // setMeshoptDecoder is not optional: scripts/glb-optimise.ts writes
    // EXT_meshopt_compression into extensionsRequired, and without a decoder GLTFLoader
    // throws "No DRACOLoader instance provided" / cannot read the compressed buffers.
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(url).then((g) => prepare(g.scene));
    loaded.set(url, p);
  }
  return p;
}

/**
 * How far a piece may be stretched out of its own proportions to fill its real footprint.
 *
 * A generated mesh is reconstructed from one photo, so its depth is a guess and is usually
 * short: the SAM 3D bed measured 1 : 0.55 : 0.71 (w : h : d) where a real bed is
 * 1 : 0.66 : 1.30. Scaling it uniformly to the catalogue footprint therefore drew a
 * 1.64 x 1.16 m bed where the product is 1.64 x 2.13 m -- half a metre of floor the
 * customer would not actually have. In a room planner the footprint is the thing being
 * judged, so the piece is stretched to match it; the cap keeps that from turning a bad
 * reconstruction into a visibly squashed one.
 */
const MAX_STRETCH = 1.6;

/**
 * The AI-generated 3D model of the product, scaled to the real piece's footprint and
 * standing on the floor, centred on it. Casts and receives shadows.
 *
 * `depth` is separate from `width` because these two are rarely equal -- a bed is half
 * again as deep as it is wide -- and fitting against the width alone (what this did
 * before) silently used the wrong axis for every oblong piece.
 */
export function AiModel({
  url,
  width,
  depth,
  height,
}: {
  url: string;
  width: number;
  depth: number;
  height: number;
}) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    loadGlb(url).then((scene) => {
      if (!alive) return;
      const copy = scene.clone(true);
      copy.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });

      const size = new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3());
      const sx = Math.max(size.x, 1e-6);
      const sy = Math.max(size.y, 1e-6);
      const sz = Math.max(size.z, 1e-6);

      /*
       * The mesh keeps whatever orientation it was generated with. Rotating it to match
       * the footprint's long axis looks obvious and is wrong: a single-view
       * reconstruction is short along the axis facing the camera, so the longest axis of
       * the mesh is often not the longest axis of the real piece. Measured on the SAM 3D
       * bed, the headboard -- a tall, thin slab -- spanned 100% of x and 4% of z and sat
       * at one end of z, so width ran along x and length along z, already correct, while
       * the mesh was *longer* in x (65534) than z (46476) and an aspect-ratio rule laid
       * the bed across the room. The planner's R key turns a piece in one keystroke,
       * which is a better answer than a guess that is wrong whenever the mesh is poor.
       */
      const k = Math.min(width / sx, depth / sz, height / sy);

      // Largest uniform fit first, then a bounded per-axis stretch toward the footprint
      // the product really occupies.
      const stretch = (want: number, have: number) => Math.min(want / (have * k), MAX_STRETCH);
      copy.scale.set(k * stretch(width, sx), k * stretch(height, sy), k * stretch(depth, sz));

      const b2 = new THREE.Box3().setFromObject(copy);
      const c = b2.getCenter(new THREE.Vector3());
      copy.position.set(-c.x, -b2.min.y, -c.z);
      const holder = new THREE.Group();
      holder.add(copy);
      setObj(holder);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [url, width, depth, height]);
  return obj ? <primitive object={obj} /> : null;
}
