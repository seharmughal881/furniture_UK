// Time-of-day model: hour (6..22) -> sun, ambient, sky colours and lamp glow.
//
// Deliberately free of three.js. HeroStory calls this for nothing but sky colours, and the
// old `import * as THREE` meant the home page carried the whole engine to get them. The sun
// direction is a plain tuple; SceneLights, which is inside a 3D chunk anyway, feeds it to a
// Vector3 there.
import { Color } from "@/lib/color";

type Key = {
  h: number;
  sun: string;
  sunI: number;
  amb: number;
  skyTop: string;
  skyBottom: string;
  glow: number;
};

const KEYS: Key[] = [
  { h: 6.0, sun: "#ff9a62", sunI: 1.1, amb: 0.3, skyTop: "#f3c4a4", skyBottom: "#eadbcc", glow: 0.55 },
  { h: 8.5, sun: "#ffdcae", sunI: 2.6, amb: 0.5, skyTop: "#f1e2cf", skyBottom: "#ece5da", glow: 0 },
  { h: 13.0, sun: "#fff6ea", sunI: 3.1, amb: 0.65, skyTop: "#ece7de", skyBottom: "#e5ded2", glow: 0 },
  { h: 17.3, sun: "#ffb46e", sunI: 2.5, amb: 0.45, skyTop: "#f0c596", skyBottom: "#e8d4bf", glow: 0.15 },
  // evening and night: near-black with a deep maroon glow low down (lamp-lit), never blue: the brand is black, white and red
  { h: 19.4, sun: "#ff8a52", sunI: 1.0, amb: 0.28, skyTop: "#1c1213", skyBottom: "#4a1418", glow: 0.75 },
  { h: 22.0, sun: "#d9a06a", sunI: 0.35, amb: 0.14, skyTop: "#0f0b0c", skyBottom: "#33100f", glow: 1 },
];

const ca = new Color();
const cb = new Color();
const mixHex = (a: string, b: string, t: number) => `#${ca.set(a).lerp(cb.set(b), t).getHexString()}`;

type Vec3 = [number, number, number];
const norm = ([x, y, z]: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export type Daylight = {
  /** Unit vector, [x, y, z]. */
  sunDir: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  skyTop: string;
  skyBottom: string;
  glow: number;
};

export function daylightAt(hour: number): Daylight {
  const h = Math.min(22, Math.max(6, hour));
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);

  // Sun travels east -> west; after ~20h the "sun" becomes a soft high light from above.
  const dayT = Math.min(1, (h - 6) / 14);
  const az = Math.PI * (0.1 + dayT * 0.8);
  const el = Math.max(0.12, Math.sin(dayT * Math.PI) * 1.05);
  let sunDir = norm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * 0.6 + 0.5]);
  if (h > 20) sunDir = norm(mix(sunDir, norm([-0.3, 1, 0.6]), (h - 20) / 2));

  return {
    sunDir,
    sunColor: mixHex(a.sun, b.sun, t),
    sunIntensity: a.sunI + (b.sunI - a.sunI) * t,
    ambient: a.amb + (b.amb - a.amb) * t,
    skyTop: mixHex(a.skyTop, b.skyTop, t),
    skyBottom: mixHex(a.skyBottom, b.skyBottom, t),
    glow: a.glow + (b.glow - a.glow) * t,
  };
}

export const formatHour = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
