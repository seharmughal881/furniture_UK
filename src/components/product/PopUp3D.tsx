"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { DepthInfo } from "@/lib/types";

/*
 * "Pop-up 3D photo": the product photo lies flat like a picture in a catalogue, then rises off
 * the page and stands up with real depth (a depth map made by scripts/make-depth.ts pushes each
 * pixel forward). Customers can then tilt it by dragging. Because the surface is the real photo,
 * colour and detail are exactly the product's — only the depth is estimated.
 */

const VERT = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uAmount, uLo, uHi;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 d = texture2D(uDepth, uv);
    // the background carries the depth of the product next to it, so edges don't tear
    float z = clamp((d.r - uLo) / max(uHi - uLo, 0.001), 0.0, 1.0);
    vec3 p = position;
    p.z += z * uAmount;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap, uDepth;
  varying vec2 vUv;
  void main() {
    if (texture2D(uDepth, vUv).a < 0.5) discard;
    gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/**
 * Cleans the depth map for display. The estimated depth fades into the background at the product's
 * outline, and the cut-out background has no depth at all, so the surface would tear into streaks
 * at every edge (thin chair legs worst). So: firm up the outline (each product pixel takes the
 * nearest depth around it), then spread the product's depth a few pixels out into the background.
 * Also returns the depth range inside the product (2nd–98th percentile).
 */
function prepareDepth(img: HTMLImageElement) {
  const W = img.width;
  const H = img.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, W, H).data;
  const fg = new Uint8Array(W * H);
  const d = new Int16Array(W * H).fill(-1);
  for (let p = 0; p < W * H; p++) {
    fg[p] = src[p * 4 + 3] > 127 ? 1 : 0;
    if (fg[p]) d[p] = src[p * 4];
  }

  // 1) firm outline: max depth over product pixels within 2 px
  const firm = Int16Array.from(d);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!fg[p]) continue;
      let m = d[p];
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && d[yy * W + xx] > m) m = d[yy * W + xx];
        }
      firm[p] = m;
    }
  // 2) spread into the background, one pixel ring per pass
  let cur = firm;
  for (let pass = 0; pass < 6; pass++) {
    const next = Int16Array.from(cur);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (cur[p] >= 0) continue;
        let m = -1;
        if (x > 0) m = Math.max(m, cur[p - 1]);
        if (x < W - 1) m = Math.max(m, cur[p + 1]);
        if (y > 0) m = Math.max(m, cur[p - W]);
        if (y < H - 1) m = Math.max(m, cur[p + W]);
        next[p] = m;
      }
    cur = next;
  }

  const hist = new Uint32Array(256);
  let n = 0;
  for (let p = 0; p < W * H; p++)
    if (fg[p]) {
      hist[cur[p]]++;
      n++;
    }
  const at = (q: number) => {
    let s = 0;
    for (let v = 0; v < 256; v++) if ((s += hist[v]) >= n * q) return v;
    return 255;
  };
  const lo = n ? at(0.02) : 0;
  const hi = n ? at(0.98) : 255;

  // rows are written bottom-up: data textures aren't flipped like the photo texture is
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const q = ((H - 1 - y) * W + x) * 4;
      out[q] = cur[p] >= 0 ? cur[p] : lo; // far background: back of the piece
      out[q + 3] = fg[p] ? 255 : 0;
    }
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { tex, lo: lo / 255, hi: hi / 255 };
}

function softShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

type Loaded = { map: THREE.Texture; depth: THREE.Texture; lo: number; hi: number };

function Scene({
  info,
  tex,
  start,
  tilt,
}: {
  info: DepthInfo;
  tex: Loaded;
  start: React.RefObject<number>;
  tilt: React.RefObject<{ x: number; dragging: boolean }>;
}) {
  const { size } = useThree();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const hinge = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.MeshBasicMaterial>(null);
  const yaw = useRef(0);

  // world units: the product's own height is 1; the plane carries the whole photo
  const [x0, y0, x1, y1] = info.box;
  const ph = 1 / Math.max(y1 - y0, 0.05);
  const pw = ph * (info.w / info.h);
  const bw = (x1 - x0) * pw;
  const amount = info.cut ? 0.42 : 0.28;
  const geo = useMemo(() => {
    const seg = 220;
    return new THREE.PlaneGeometry(pw, ph, Math.round(seg * Math.min(1, pw / ph)), Math.round(seg * Math.min(1, ph / pw)));
  }, [pw, ph]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: tex.map },
          uDepth: { value: tex.depth },
          uAmount: { value: 0 },
          uLo: { value: tex.lo },
          uHi: { value: tex.hi },
        },
      }),
    [tex],
  );
  const shadowTex = useMemo(() => softShadow(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      shadowTex.dispose();
    },
    [geo, mat, shadowTex],
  );

  useFrame((_, dt) => {
    const t = (performance.now() - start.current) / 1000;
    // 1) look down at the flat "catalogue page", 2) the piece hinges up off the page with depth
    const look = ease(span(t, 0, 0.7));
    const rise = backOut(span(t, 0.55, 1.75));
    const settle = ease(span(t, 0.6, 1.9));
    const elev = THREE.MathUtils.degToRad(89.5 - 34.5 * look - 41 * settle);

    if (hinge.current) hinge.current.rotation.x = -Math.PI / 2 * (1 - rise);
    mat.uniforms.uAmount.value = amount * Math.min(1, Math.max(0, rise));
    if (shadow.current) shadow.current.opacity = 0.9 * Math.min(1, Math.max(0, rise));

    // drag to tilt; otherwise a gentle sway once it has stood up
    const want = tilt.current.dragging ? tilt.current.x : t > 2 ? Math.sin((t - 2) * 0.7) * 0.18 : 0;
    yaw.current += (want - yaw.current) * (1 - Math.exp(-dt * 6));
    if (turn.current) turn.current.rotation.y = yaw.current;

    // frame the piece: flat print at first, standing piece at the end
    const c = cam.current;
    if (!c) return;
    const aspect = size.width / Math.max(size.height, 1);
    const fit = Math.max(bw / aspect, 1 + amount * 0.3) * 1.45;
    const dist = fit / 2 / Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
    const target = new THREE.Vector3(0, 0.5 * settle, -0.5 * (1 - settle) + amount * 0.3 * settle);
    c.position.set(target.x, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * dist);
    c.lookAt(target);
  });

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault fov={30} near={0.05} far={50} />
      <group ref={turn}>
        {/* the catalogue page the photo is printed on */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, -0.5]}>
          <planeGeometry args={[Math.max(bw, 1) + 0.6, 1.6]} />
          <meshBasicMaterial color="#f6f3ee" toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, amount * 0.35]}>
          <planeGeometry args={[bw * 1.25, amount + 0.5]} />
          <meshBasicMaterial ref={shadow} map={shadowTex} transparent depthWrite={false} opacity={0} toneMapped={false} />
        </mesh>
        <group ref={hinge}>
          {/* bottom-centre of the product sits on the hinge */}
          <mesh geometry={geo} material={mat} position={[pw / 2 - ((x0 + x1) / 2) * pw, ph * y1 - ph / 2, 0]} />
        </group>
      </group>
    </>
  );
}

function useTextures(photo: string, depthSrc: string) {
  const [tex, setTex] = useState<Loaded | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
    Promise.all([loader.loadAsync(photo), loader.loadAsync(depthSrc)])
      .then(([map, raw]) => {
        if (!alive) return;
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
        const { tex: depth, lo, hi } = prepareDepth(raw.image as HTMLImageElement);
        raw.dispose();
        setTex({ map, depth, lo, hi });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [photo, depthSrc]);
  useEffect(
    () => () => {
      tex?.map.dispose();
      tex?.depth.dispose();
    },
    [tex],
  );
  return tex;
}

/** The pop-up 3D view that replaces the main gallery photo. */
export function PopUp3D({ photo, info, onClose }: { photo: string; info: DepthInfo & { src: string }; onClose: () => void }) {
  const tex = useTextures(photo, info.src);
  const start = useRef(0);
  const tilt = useRef({ x: 0, dragging: false });
  const drag = useRef<{ x: number; w: number } | null>(null);
  // the clock starts when both images are ready, so the animation is never half-way when it appears
  useEffect(() => {
    if (tex) start.current = performance.now();
  }, [tex]);

  return (
    <div
      className="gallery-main pop3d"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, w: e.currentTarget.clientWidth };
        tilt.current.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        tilt.current.x = THREE.MathUtils.clamp(((e.clientX - drag.current.x) / drag.current.w) * 1.4, -0.45, 0.45);
      }}
      onPointerUp={() => {
        drag.current = null;
        tilt.current.dragging = false;
      }}
      onPointerCancel={() => {
        drag.current = null;
        tilt.current.dragging = false;
      }}
    >
      {tex ? (
        <View style={{ position: "absolute", inset: 0 }}>
          <Scene info={info} tex={tex} start={start} tilt={tilt} />
        </View>
      ) : (
        <p className="pop3d-wait">Opening 3D…</p>
      )}
      <div className="pop3d-bar">
        <button onClick={() => (start.current = performance.now())}>↻ Replay</button>
        <span>Drag to tilt</span>
        <button onClick={onClose}>✕ Photo</button>
      </div>
    </div>
  );
}
