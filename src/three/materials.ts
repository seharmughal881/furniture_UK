// Custom-patched three.js materials.
//
// Every furniture material gets two shader effects injected via onBeforeCompile:
//  1. uReveal  – parts "materialise": fragments are discarded along an organic
//                noise front with a glowing ember edge (blueprint -> real object).
//  2. uMix     – colour morph: when a swatch changes, the new colour sweeps over
//                the surface along the same kind of noise front with a soft glow.
// A matching depth material keeps shadows in sync with the reveal.
import * as THREE from "three";
import type { PartRole } from "./furniture";

const NOISE_GLSL = /* glsl */ `
  varying vec3 vObjPos;
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
                   mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                   mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return vnoise(p) * 0.6 + vnoise(p * 2.13) * 0.3 + vnoise(p * 4.7) * 0.1; }
`;

export type RevealUniforms = { uReveal: { value: number } };

function patchVertex(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;")
    .replace(
      "#include <begin_vertex>",
      // world-ish position so neighbouring parts share one continuous front
      "#include <begin_vertex>\nvObjPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
}

/** Revealing fragment: discard + returns edge factor `edge` (0..1). */
const REVEAL_FRAGMENT = /* glsl */ `
  float revealN = fbm(vObjPos * 5.0 + vec3(0.0, vObjPos.y * 2.0, 0.0));
  float revealT = uReveal * 1.25 - 0.12;
  if (revealN > revealT) discard;
  float edge = 1.0 - smoothstep(0.0, 0.07, revealT - revealN);
`;

export function createFurnitureMaterial(
  role: PartRole,
  reveal: RevealUniforms,
  textures: { wood: THREE.Texture; weave: THREE.Texture },
  initialColor: string,
) {
  let mat: THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;
  switch (role) {
    case "fabric":
    case "accent":
      mat = new THREE.MeshPhysicalMaterial({
        roughness: 0.92,
        sheen: 1,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color("#ffffff"),
        bumpMap: textures.weave,
        bumpScale: 1.2,
      });
      break;
    case "shade":
      mat = new THREE.MeshPhysicalMaterial({
        roughness: 0.95,
        side: THREE.DoubleSide,
        bumpMap: textures.weave,
        bumpScale: 0.8,
        emissive: new THREE.Color("#ffb46b"),
        emissiveIntensity: 0,
      });
      break;
    case "wood":
      mat = new THREE.MeshPhysicalMaterial({
        map: textures.wood,
        roughness: 0.5,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45,
      });
      break;
    case "metal":
      mat = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.32 });
      break;
    case "book":
      mat = new THREE.MeshPhysicalMaterial({ roughness: 0.7 });
      break;
    case "mirror":
      // a true mirror reflects the empty void behind the camera, so fake a bright silvered glass
      mat = new THREE.MeshPhysicalMaterial({ metalness: 0.35, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
      break;
    case "bulb":
      mat = new THREE.MeshBasicMaterial({ color: "#fff1d6" });
      break;
  }

  const target = new THREE.Color(initialColor);
  const uniforms = {
    ...reveal,
    uFrom: { value: target.clone() },
    uTo: { value: target.clone() },
    uMix: { value: 1 },
    uSeed: { value: Math.random() * 10 },
  };

  if (mat instanceof THREE.MeshPhysicalMaterial) {
    mat.color.set("#ffffff"); // colour comes from uFrom/uTo
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      patchVertex(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uReveal; uniform float uMix; uniform float uSeed;
           uniform vec3 uFrom; uniform vec3 uTo;
           ${NOISE_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           ${REVEAL_FRAGMENT}
           // colour morph front sweeps bottom-up with noise
           float mixN = fbm(vObjPos * 3.0 + uSeed) * 0.55 + clamp(vObjPos.y * 0.45, 0.0, 0.45);
           float mixT = uMix * 1.3 - 0.15;
           float m = smoothstep(mixT - 0.02, mixT + 0.02, mixN);
           vec3 morph = mix(uTo, uFrom, m);
           diffuseColor.rgb *= morph;
           float mixEdge = (1.0 - smoothstep(0.0, 0.05, abs(mixN - mixT))) * step(uMix, 0.999);
           totalEmissiveRadiance += vec3(1.0, 0.62, 0.32) * (edge * 2.6) + uTo * mixEdge * 0.9;`,
        );
    };
    mat.customProgramCacheKey = () => `atelier-${role}`;
  } else {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      patchVertex(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform float uReveal;\n${NOISE_GLSL}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${REVEAL_FRAGMENT}`);
    };
    mat.customProgramCacheKey = () => "atelier-basic";
  }

  return { material: mat, uniforms };
}

/** Depth material for shadow casting that respects the reveal front. */
export function createRevealDepthMaterial(reveal: RevealUniforms) {
  const mat = new THREE.MeshDepthMaterial();
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, reveal);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uReveal;\n${NOISE_GLSL}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\n${REVEAL_FRAGMENT}`,
      );
  };
  mat.customProgramCacheKey = () => "atelier-depth";
  return mat;
}

// ---------------------------------------------------------------------------
// Procedural textures (no image downloads needed).

let cached: { wood: THREE.Texture; weave: THREE.Texture } | null = null;

export function getProceduralTextures() {
  if (cached) return cached;

  // Wood grain: near-white so the material colour tints it.
  const wc = document.createElement("canvas");
  wc.width = wc.height = 512;
  const w = wc.getContext("2d")!;
  w.fillStyle = "#f4f0ea";
  w.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const y0 = Math.random() * 512;
    const amp = 4 + Math.random() * 14;
    const freq = 0.004 + Math.random() * 0.01;
    const shade = 200 + Math.random() * 45;
    w.strokeStyle = `rgba(${shade - 40},${shade - 55},${shade - 70},${0.12 + Math.random() * 0.22})`;
    w.lineWidth = 0.6 + Math.random() * 2.2;
    w.beginPath();
    for (let x = 0; x <= 512; x += 4) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) w.moveTo(x, y);
      else w.lineTo(x, y);
    }
    w.stroke();
  }
  const wood = new THREE.CanvasTexture(wc);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.anisotropy = 8;

  // Fabric weave bump map.
  const fc = document.createElement("canvas");
  fc.width = fc.height = 128;
  const f = fc.getContext("2d")!;
  f.fillStyle = "#808080";
  f.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const over = ((x >> 2) + (y >> 2)) % 2 === 0;
      f.fillStyle = over ? "#a8a8a8" : "#5c5c5c";
      f.fillRect(x, y, over ? 4 : 3, over ? 3 : 4);
    }
  }
  for (let i = 0; i < 900; i++) {
    f.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},0,0,0.05)`;
    f.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  const weave = new THREE.CanvasTexture(fc);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(10, 10);

  cached = { wood, weave };
  return cached;
}
