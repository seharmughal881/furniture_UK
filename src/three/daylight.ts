// Time-of-day model: hour (6..22) -> sun, ambient, sky colours and lamp glow.
import * as THREE from "three";

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
  { h: 19.4, sun: "#ff7a52", sunI: 1.0, amb: 0.28, skyTop: "#5f5374", skyBottom: "#c98b6c", glow: 0.75 },
  { h: 22.0, sun: "#7088cc", sunI: 0.35, amb: 0.14, skyTop: "#121828", skyBottom: "#262d44", glow: 1 },
];

const ca = new THREE.Color();
const cb = new THREE.Color();
const mixHex = (a: string, b: string, t: number) => `#${ca.set(a).lerp(cb.set(b), t).getHexString()}`;

export type Daylight = {
  sunDir: THREE.Vector3;
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

  // Sun travels east -> west; after ~20h the "sun" becomes a high cool moonlight.
  const dayT = Math.min(1, (h - 6) / 14);
  const az = Math.PI * (0.1 + dayT * 0.8);
  const el = Math.max(0.12, Math.sin(dayT * Math.PI) * 1.05);
  const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * 0.6 + 0.5).normalize();
  if (h > 20) sunDir.lerp(new THREE.Vector3(-0.3, 1, 0.6).normalize(), (h - 20) / 2).normalize();

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
