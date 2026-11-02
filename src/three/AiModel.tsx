"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

/** Asks the server for the product's AI 3D model, starting generation if needed, and polls until ready. */
export function useAiModel(slug: string | undefined, enabled: boolean) {
  const [state, setState] = useState<AiState>({ status: "loading" });
  useEffect(() => {
    if (!slug || !enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async (first: boolean) => {
      let p = first ? states.get(slug) : undefined;
      if (!p) {
        p = fetchState(slug, first);
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
  }, [slug, enabled]);
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
    p = new GLTFLoader().loadAsync(url).then((g) => prepare(g.scene));
    loaded.set(url, p);
  }
  return p;
}

/**
 * The AI-generated 3D model of the product, scaled so its width/height match the real piece
 * and standing on the floor, centred on its footprint. Casts and receives shadows.
 */
export function AiModel({ url, width, height }: { url: string; width: number; height: number }) {
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
      // normalise: fit inside the real width x height, keep proportions, sit on the floor
      const box = new THREE.Box3().setFromObject(copy);
      const size = box.getSize(new THREE.Vector3());
      const k = Math.min(width / Math.max(size.x, size.z, 1e-3), height / Math.max(size.y, 1e-3));
      copy.scale.setScalar(k);
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
  }, [url, width, height]);
  return obj ? <primitive object={obj} /> : null;
}
