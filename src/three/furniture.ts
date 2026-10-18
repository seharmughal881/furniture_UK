// Procedural furniture. Every model is a list of parts so each part can be
// animated independently (the "self-assembly" effect). Units are metres, y-up,
// floor at y = 0.

export type FurnitureKind =
  | "sofa" | "armchair" | "coffeeTable" | "floorLamp" | "bookshelf" | "sideTable"
  | "sectional" | "mediaConsole" | "pouf" | "rug" | "consoleTable"
  | "bed" | "nightstand" | "dresser" | "wardrobe" | "mirror" | "bench" | "tableLamp"
  | "diningTable" | "diningChair" | "sideboard" | "barStool"
  | "desk" | "officeChair";

export type PartRole = "fabric" | "accent" | "wood" | "metal" | "shade" | "bulb" | "book" | "mirror";

export type Part = {
  shape: "box" | "cyl" | "sphere";
  /** box: [w, h, d] · cyl: [radiusTop, radiusBottom, height] · sphere: [radius] */
  size: number[];
  pos: [number, number, number];
  rot?: [number, number, number];
  role: PartRole;
  /** Corner radius for rounded boxes. */
  radius?: number;
  /** Fixed colour (books, bed linen, casters) — not affected by the chosen materials. */
  color?: string;
};

const legs = (x: number, z: number, h: number, role: PartRole = "wood", r = 0.024): Part[] =>
  [
    [x, z],
    [-x, z],
    [x, -z],
    [-x, -z],
  ].map(([px, pz]) => ({ shape: "cyl", size: [r, r * 0.7, h], pos: [px, h / 2, pz], role }));

const sofa: Part[] = [
  ...legs(0.95, 0.36, 0.12),
  { shape: "box", size: [2.06, 0.1, 0.86], pos: [0, 0.17, 0], role: "wood", radius: 0.02 },
  { shape: "box", size: [2.0, 0.14, 0.84], pos: [0, 0.29, 0], role: "fabric", radius: 0.04 },
  { shape: "box", size: [0.18, 0.44, 0.88], pos: [0.94, 0.44, 0], role: "fabric", radius: 0.07 },
  { shape: "box", size: [0.18, 0.44, 0.88], pos: [-0.94, 0.44, 0], role: "fabric", radius: 0.07 },
  { shape: "box", size: [1.72, 0.44, 0.18], pos: [0, 0.58, -0.34], role: "fabric", radius: 0.06 },
  { shape: "box", size: [0.84, 0.17, 0.64], pos: [0.425, 0.44, 0.08], role: "fabric", radius: 0.07 },
  { shape: "box", size: [0.84, 0.17, 0.64], pos: [-0.425, 0.44, 0.08], role: "fabric", radius: 0.07 },
  { shape: "box", size: [0.82, 0.4, 0.17], pos: [0.425, 0.69, -0.2], rot: [-0.14, 0, 0], role: "fabric", radius: 0.07 },
  { shape: "box", size: [0.82, 0.4, 0.17], pos: [-0.425, 0.69, -0.2], rot: [-0.14, 0, 0], role: "fabric", radius: 0.07 },
  { shape: "box", size: [0.42, 0.38, 0.13], pos: [0.62, 0.71, -0.06], rot: [-0.25, -0.35, 0.12], role: "accent", radius: 0.06 },
  { shape: "box", size: [0.38, 0.34, 0.12], pos: [-0.66, 0.69, -0.07], rot: [-0.22, 0.3, -0.1], role: "accent", radius: 0.055 },
];

const armchair: Part[] = [
  ...legs(0.36, 0.33, 0.14),
  { shape: "box", size: [0.84, 0.08, 0.8], pos: [0, 0.18, 0], role: "wood", radius: 0.02 },
  { shape: "box", size: [0.78, 0.14, 0.78], pos: [0, 0.29, 0], role: "fabric", radius: 0.04 },
  { shape: "box", size: [0.13, 0.4, 0.8], pos: [0.36, 0.44, 0], role: "fabric", radius: 0.06 },
  { shape: "box", size: [0.13, 0.4, 0.8], pos: [-0.36, 0.44, 0], role: "fabric", radius: 0.06 },
  { shape: "box", size: [0.62, 0.5, 0.15], pos: [0, 0.6, -0.33], rot: [-0.12, 0, 0], role: "fabric", radius: 0.06 },
  { shape: "box", size: [0.6, 0.15, 0.6], pos: [0, 0.43, 0.06], role: "fabric", radius: 0.065 },
  { shape: "box", size: [0.58, 0.36, 0.13], pos: [0, 0.66, -0.22], rot: [-0.18, 0, 0], role: "accent", radius: 0.06 },
];

const coffeeTable: Part[] = [
  ...[0, 1, 2].map((i): Part => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    return { shape: "cyl", size: [0.014, 0.014, 0.34], pos: [Math.cos(a) * 0.33, 0.17, Math.sin(a) * 0.33], role: "metal" };
  }),
  { shape: "cyl", size: [0.38, 0.38, 0.024], pos: [0, 0.12, 0], role: "wood" },
  { shape: "cyl", size: [0.45, 0.44, 0.04], pos: [0, 0.36, 0], role: "wood" },
];

const floorLamp: Part[] = [
  { shape: "cyl", size: [0.16, 0.17, 0.025], pos: [0, 0.0125, 0], role: "metal" },
  { shape: "cyl", size: [0.011, 0.011, 1.42], pos: [0, 0.735, 0], role: "metal" },
  { shape: "sphere", size: [0.045], pos: [0, 1.44, 0], role: "bulb" },
  { shape: "cyl", size: [0.13, 0.23, 0.3], pos: [0, 1.46, 0], role: "shade" },
];

const BOOK_COLORS = ["#7c3f2c", "#2f4a5c", "#c8b28a", "#3d5a40", "#a8652f", "#1f2430", "#d9cbb3", "#8a2f2f"];
const bookRow = (y: number, x0: number, count: number, seed: number): Part[] => {
  const out: Part[] = [];
  let x = x0;
  for (let i = 0; i < count; i++) {
    const h = 0.2 + ((i * 37 + seed * 11) % 7) * 0.025;
    const w = 0.03 + ((i * 13 + seed) % 3) * 0.012;
    out.push({
      shape: "box",
      size: [w, h, 0.22],
      pos: [x + w / 2, y + h / 2, 0.01],
      role: "book",
      radius: 0.004,
      color: BOOK_COLORS[(i + seed * 3) % BOOK_COLORS.length],
    });
    x += w + 0.004;
  }
  return out;
};

const bookshelf: Part[] = [
  { shape: "box", size: [0.03, 1.8, 0.32], pos: [0.435, 0.9, 0], role: "wood", radius: 0.006 },
  { shape: "box", size: [0.03, 1.8, 0.32], pos: [-0.435, 0.9, 0], role: "wood", radius: 0.006 },
  { shape: "box", size: [0.84, 1.74, 0.014], pos: [0, 0.9, -0.15], role: "wood", radius: 0.003 },
  ...[0.06, 0.48, 0.9, 1.32, 1.765].map(
    (y): Part => ({ shape: "box", size: [0.84, 0.026, 0.3], pos: [0, y, 0], role: "wood", radius: 0.004 }),
  ),
  ...bookRow(0.073, -0.4, 9, 1),
  ...bookRow(0.493, -0.12, 7, 2),
  ...bookRow(0.913, -0.4, 6, 3),
  { shape: "sphere", size: [0.07], pos: [0.25, 0.983, 0.02], role: "metal" },
  ...bookRow(1.333, -0.05, 8, 4),
];

const sideTable: Part[] = [
  { shape: "cyl", size: [0.17, 0.18, 0.02], pos: [0, 0.01, 0], role: "metal" },
  { shape: "cyl", size: [0.022, 0.022, 0.5], pos: [0, 0.27, 0], role: "metal" },
  { shape: "cyl", size: [0.24, 0.235, 0.032], pos: [0, 0.535, 0], role: "wood" },
];

const box = (size: [number, number, number], pos: [number, number, number], role: PartRole, radius = 0.01, extra: Partial<Part> = {}): Part => ({
  shape: "box", size, pos, role, radius, ...extra,
});
const cyl = (rt: number, rb: number, h: number, pos: [number, number, number], role: PartRole, extra: Partial<Part> = {}): Part => ({
  shape: "cyl", size: [rt, rb, h], pos, role, ...extra,
});
const LINEN = "#f3f0ea";
const CASTER = "#222222";

/** Drawer/door front with a small metal pull, sitting proud of a carcass face at z. */
const front = (x: number, y: number, z: number, w: number, h: number, pull: "h" | "v" = "h", pullX = 0): Part[] => [
  box([w, h, 0.02], [x, y, z], "wood", 0.004),
  pull === "h"
    ? box([Math.min(0.14, w * 0.4), 0.012, 0.02], [x + pullX, y, z + 0.02], "metal", 0.004)
    : cyl(0.007, 0.007, Math.min(0.3, h * 0.35), [x + pullX, y, z + 0.022], "metal"),
];

const sectional: Part[] = [
  // main section spans z -0.8..0.1, chaise spans x 0.53..1.35 / z 0.06..0.82
  ...[[-1.28, -0.74], [0, -0.74], [1.28, -0.74], [-1.28, 0.04], [0.6, 0.76], [1.28, 0.76]].map(([x, z]) =>
    cyl(0.024, 0.017, 0.12, [x, 0.06, z], "wood")),
  box([2.7, 0.1, 0.9], [0, 0.17, -0.35], "wood", 0.02),
  box([0.82, 0.1, 0.76], [0.94, 0.17, 0.44], "wood", 0.02),
  box([2.64, 0.14, 0.88], [0, 0.29, -0.35], "fabric", 0.04),
  box([0.8, 0.14, 0.74], [0.94, 0.29, 0.44], "fabric", 0.04),
  box([2.5, 0.44, 0.18], [0.1, 0.58, -0.71], "fabric", 0.06),
  box([0.18, 0.44, 0.9], [-1.26, 0.44, -0.35], "fabric", 0.07),
  box([0.8, 0.17, 0.64], [-0.78, 0.44, -0.27], "fabric", 0.07),
  box([0.8, 0.17, 0.64], [0.03, 0.44, -0.27], "fabric", 0.07),
  box([0.8, 0.17, 1.42], [0.93, 0.44, 0.09], "fabric", 0.07),
  box([0.8, 0.4, 0.17], [-0.78, 0.69, -0.56], "fabric", 0.07, { rot: [-0.14, 0, 0] }),
  box([0.8, 0.4, 0.17], [0.03, 0.69, -0.56], "fabric", 0.07, { rot: [-0.14, 0, 0] }),
  box([0.8, 0.4, 0.17], [0.93, 0.69, -0.56], "fabric", 0.07, { rot: [-0.14, 0, 0] }),
  box([0.42, 0.38, 0.13], [-0.98, 0.71, -0.42], "accent", 0.06, { rot: [-0.25, 0.35, 0.1] }),
  box([0.4, 0.36, 0.12], [1.05, 0.7, -0.42], "accent", 0.055, { rot: [-0.22, -0.3, -0.1] }),
];

const mediaConsole: Part[] = [
  ...legs(0.84, 0.17, 0.14, "metal", 0.015),
  box([1.8, 0.36, 0.42], [0, 0.32, 0], "wood", 0.01),
  ...[-0.6, 0, 0.6].flatMap((x) => front(x, 0.32, 0.215, 0.58, 0.32)),
];

const pouf: Part[] = [
  cyl(0.26, 0.26, 0.04, [0, 0.02, 0], "wood"),
  cyl(0.27, 0.28, 0.36, [0, 0.22, 0], "fabric"),
  { shape: "sphere", size: [0.025], pos: [0, 0.405, 0], role: "accent" },
];

const rug: Part[] = [
  box([2.0, 0.012, 3.0], [0, 0.006, 0], "fabric", 0.005),
  box([1.9, 0.014, 0.06], [0, 0.008, -1.32], "accent", 0.005),
  box([1.9, 0.014, 0.06], [0, 0.008, 1.32], "accent", 0.005),
  box([0.06, 0.014, 2.5], [-0.82, 0.008, 0], "accent", 0.005),
  box([0.06, 0.014, 2.5], [0.82, 0.008, 0], "accent", 0.005),
];

const consoleTable: Part[] = [
  ...[[0.57, 0.15], [-0.57, 0.15], [0.57, -0.15], [-0.57, -0.15]].map(([x, z]) =>
    box([0.025, 0.75, 0.025], [x, 0.375, z], "metal", 0.005)),
  box([1.1, 0.02, 0.3], [0, 0.2, 0], "wood", 0.005),
  box([1.2, 0.03, 0.35], [0, 0.765, 0], "wood", 0.006),
];

const bed: Part[] = [
  // UK king: 150 x 200 cm mattress on a 160 x 206 cm frame, 164 cm headboard
  ...legs(0.73, 0.95, 0.14, "wood", 0.03),
  box([1.6, 0.18, 2.06], [0, 0.23, 0.035], "wood", 0.02),
  box([1.64, 0.75, 0.1], [0, 0.7, -1.015], "fabric", 0.05),
  box([1.5, 0.24, 2.0], [0, 0.44, 0.04], "fabric", 0.06, { color: LINEN }),
  box([0.64, 0.14, 0.42], [-0.37, 0.62, -0.72], "fabric", 0.06, { color: "#faf8f3", rot: [-0.25, 0, 0] }),
  box([0.64, 0.14, 0.42], [0.37, 0.62, -0.72], "fabric", 0.06, { color: "#faf8f3", rot: [-0.25, 0, 0] }),
  box([0.48, 0.3, 0.12], [-0.3, 0.7, -0.52], "accent", 0.05, { rot: [-0.32, 0.12, 0] }),
  box([0.48, 0.3, 0.12], [0.3, 0.7, -0.52], "accent", 0.05, { rot: [-0.32, -0.12, 0] }),
  box([1.56, 0.06, 1.42], [0, 0.585, 0.33], "fabric", 0.03),
  box([1.56, 0.09, 0.24], [0, 0.6, -0.33], "accent", 0.04),
];

const nightstand: Part[] = [
  ...legs(0.21, 0.16, 0.14, "wood", 0.018),
  box([0.5, 0.42, 0.4], [0, 0.34, 0], "wood", 0.01),
  ...front(0, 0.445, 0.205, 0.46, 0.17),
  ...front(0, 0.24, 0.205, 0.46, 0.17),
];

const dresser: Part[] = [
  ...legs(0.56, 0.21, 0.14, "wood", 0.02),
  box([1.2, 0.68, 0.5], [0, 0.48, 0], "wood", 0.01),
  ...[0.26, 0.48, 0.7].flatMap((y) => [-0.3, 0.3].flatMap((x) => front(x, y, 0.255, 0.58, 0.2))),
];

const wardrobe: Part[] = [
  box([0.96, 0.06, 0.56], [0, 0.03, 0], "wood", 0.005),
  box([1.0, 1.94, 0.6], [0, 1.03, 0], "wood", 0.008),
  ...front(-0.25, 1.03, 0.31, 0.495, 1.9, "v", 0.2),
  ...front(0.25, 1.03, 0.31, 0.495, 1.9, "v", -0.2),
  box([1.02, 0.03, 0.62], [0, 2.015, 0], "wood", 0.005),
];

const mirror: Part[] = [
  box([0.7, 1.8, 0.04], [0, 0.9, -0.08], "wood", 0.01, { rot: [-0.1, 0, 0] }),
  box([0.6, 1.7, 0.012], [0, 0.905, -0.055], "mirror", 0.004, { rot: [-0.1, 0, 0] }),
];

const bench: Part[] = [
  box([0.04, 0.33, 0.36], [-0.56, 0.165, 0], "wood", 0.006),
  box([0.04, 0.33, 0.36], [0.56, 0.165, 0], "wood", 0.006),
  box([1.08, 0.03, 0.03], [0, 0.12, 0], "wood", 0.006),
  box([1.2, 0.04, 0.4], [0, 0.35, 0], "wood", 0.008),
  box([1.18, 0.08, 0.38], [0, 0.41, 0], "fabric", 0.03),
];

const tableLamp: Part[] = [
  { shape: "sphere", size: [0.09], pos: [0, 0.09, 0], role: "metal" },
  cyl(0.008, 0.008, 0.16, [0, 0.24, 0], "metal"),
  { shape: "sphere", size: [0.03], pos: [0, 0.33, 0], role: "bulb" },
  cyl(0.1, 0.15, 0.18, [0, 0.37, 0], "shade"),
];

const diningTable: Part[] = [
  ...[[0.82, 0.37], [-0.82, 0.37], [0.82, -0.37], [-0.82, -0.37]].map(([x, z]) =>
    box([0.06, 0.67, 0.06], [x, 0.335, z], "wood", 0.008)),
  box([1.6, 0.08, 0.72], [0, 0.67, 0], "wood", 0.005),
  box([1.8, 0.04, 0.9], [0, 0.73, 0], "wood", 0.01),
];

const diningChair: Part[] = [
  ...legs(0.19, 0.2, 0.45, "wood", 0.018),
  box([0.03, 0.4, 0.03], [-0.2, 0.64, -0.21], "wood", 0.006, { rot: [-0.08, 0, 0] }),
  box([0.03, 0.4, 0.03], [0.2, 0.64, -0.21], "wood", 0.006, { rot: [-0.08, 0, 0] }),
  box([0.44, 0.03, 0.44], [0, 0.465, 0], "wood", 0.006),
  box([0.46, 0.06, 0.46], [0, 0.505, 0.005], "fabric", 0.025),
  box([0.44, 0.13, 0.03], [0, 0.77, -0.235], "wood", 0.01, { rot: [-0.1, 0, 0] }),
];

const sideboard: Part[] = [
  ...legs(0.74, 0.18, 0.18, "wood", 0.02),
  box([1.6, 0.62, 0.45], [0, 0.49, 0], "wood", 0.01),
  ...[-0.6, -0.2, 0.2, 0.6].flatMap((x, i) => front(x, 0.49, 0.23, 0.39, 0.58, "v", i % 2 ? -0.16 : 0.16)),
];

const barStool: Part[] = [
  ...[[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]].map(([x, z]) => cyl(0.012, 0.012, 0.72, [x, 0.36, z], "metal")),
  box([0.24, 0.015, 0.015], [0, 0.28, 0.12], "metal", 0.004),
  box([0.24, 0.015, 0.015], [0, 0.28, -0.12], "metal", 0.004),
  box([0.015, 0.015, 0.24], [0.12, 0.28, 0], "metal", 0.004),
  box([0.015, 0.015, 0.24], [-0.12, 0.28, 0], "metal", 0.004),
  cyl(0.19, 0.18, 0.04, [0, 0.74, 0], "wood"),
];

const desk: Part[] = [
  ...[[0.66, 0.31], [-0.66, 0.31], [0.66, -0.31], [-0.66, -0.31]].map(([x, z]) => cyl(0.013, 0.013, 0.72, [x, 0.36, z], "metal")),
  box([0.42, 0.1, 0.56], [0.42, 0.67, -0.02], "wood", 0.006),
  box([0.12, 0.012, 0.02], [0.42, 0.67, 0.27], "metal", 0.004),
  box([1.4, 0.03, 0.7], [0, 0.735, 0], "wood", 0.006),
];

const officeChair: Part[] = [
  ...[0, 1, 2, 3, 4].flatMap((i): Part[] => {
    const a = (i / 5) * Math.PI * 2;
    return [
      box([0.3, 0.03, 0.045], [Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15], "metal", 0.01, { rot: [0, -a, 0] }),
      { shape: "sphere", size: [0.028], pos: [Math.cos(a) * 0.29, 0.028, Math.sin(a) * 0.29], role: "metal", color: CASTER },
    ];
  }),
  cyl(0.025, 0.03, 0.34, [0, 0.25, 0], "metal"),
  box([0.04, 0.32, 0.03], [0, 0.6, -0.23], "metal", 0.008),
  box([0.03, 0.18, 0.03], [-0.27, 0.58, 0], "metal", 0.008),
  box([0.03, 0.18, 0.03], [0.27, 0.58, 0], "metal", 0.008),
  box([0.06, 0.03, 0.24], [-0.27, 0.68, 0], "metal", 0.012, { color: CASTER }),
  box([0.06, 0.03, 0.24], [0.27, 0.68, 0], "metal", 0.012, { color: CASTER }),
  box([0.5, 0.08, 0.48], [0, 0.46, 0.01], "fabric", 0.04),
  box([0.46, 0.52, 0.07], [0, 0.82, -0.25], "fabric", 0.05, { rot: [-0.1, 0, 0] }),
];

export const FURNITURE: Record<FurnitureKind, Part[]> = {
  sofa, armchair, coffeeTable, floorLamp, bookshelf, sideTable,
  sectional, mediaConsole, pouf, rug, consoleTable,
  bed, nightstand, dresser, wardrobe, mirror, bench, tableLamp,
  diningTable, diningChair, sideboard, barStool,
  desk, officeChair,
};

export const KINDS = Object.keys(FURNITURE) as [FurnitureKind, ...FurnitureKind[]];

/** Footprint [width, depth] in metres, used by the planner. */
export const FOOTPRINT: Record<FurnitureKind, [number, number]> = {
  sofa: [2.1, 0.9], armchair: [0.86, 0.84], coffeeTable: [0.9, 0.9], floorLamp: [0.48, 0.48],
  bookshelf: [0.9, 0.32], sideTable: [0.48, 0.48],
  sectional: [2.7, 1.62], mediaConsole: [1.8, 0.42], pouf: [0.56, 0.56], rug: [2.0, 3.0], consoleTable: [1.2, 0.35],
  bed: [1.64, 2.13], nightstand: [0.5, 0.4], dresser: [1.2, 0.5], wardrobe: [1.0, 0.62], mirror: [0.7, 0.3],
  bench: [1.2, 0.4], tableLamp: [0.3, 0.3],
  diningTable: [1.8, 0.9], diningChair: [0.46, 0.5], sideboard: [1.6, 0.45], barStool: [0.38, 0.38],
  desk: [1.4, 0.7], officeChair: [0.62, 0.62],
};

/** Overall height in metres (camera framing). */
export const HEIGHT: Record<FurnitureKind, number> = {
  sofa: 0.82, armchair: 0.8, coffeeTable: 0.38, floorLamp: 1.6, bookshelf: 1.8, sideTable: 0.55,
  sectional: 0.82, mediaConsole: 0.5, pouf: 0.42, rug: 0.4, consoleTable: 0.78,
  bed: 1.08, nightstand: 0.55, dresser: 0.82, wardrobe: 2.03, mirror: 1.8, bench: 0.45, tableLamp: 0.46,
  diningTable: 0.75, diningChair: 0.83, sideboard: 0.8, barStool: 0.76,
  desk: 0.75, officeChair: 1.08,
};

/** Top surface height for pieces that small items (table lamps) can stand on. */
export const SURFACE: Partial<Record<FurnitureKind, number>> = {
  nightstand: 0.55, sideTable: 0.55, dresser: 0.82, desk: 0.75, consoleTable: 0.78, sideboard: 0.8,
  mediaConsole: 0.5, diningTable: 0.75, coffeeTable: 0.38,
};

/** Kinds that sit on top of surfaces when placed over them. */
export const STACKABLE: FurnitureKind[] = ["tableLamp"];

export const KIND_LABEL: Record<FurnitureKind, string> = {
  sofa: "Sofa", armchair: "Lounge chair", coffeeTable: "Coffee table", floorLamp: "Floor lamp",
  bookshelf: "Bookshelf", sideTable: "Side table",
  sectional: "Corner sofa", mediaConsole: "Media console", pouf: "Pouf", rug: "Rug", consoleTable: "Console table",
  bed: "Bed", nightstand: "Bedside table", dresser: "Dresser", wardrobe: "Wardrobe", mirror: "Floor mirror",
  bench: "Bench", tableLamp: "Table lamp",
  diningTable: "Dining table", diningChair: "Dining chair", sideboard: "Sideboard", barStool: "Counter stool",
  desk: "Desk", officeChair: "Task chair",
};

/** Which customer-selectable material roles each kind uses. */
export const ROLES_FOR: Record<FurnitureKind, ("fabric" | "wood" | "metal")[]> = {
  sofa: ["fabric", "wood"], armchair: ["fabric", "wood"], coffeeTable: ["wood", "metal"], floorLamp: ["metal"],
  bookshelf: ["wood"], sideTable: ["wood", "metal"],
  sectional: ["fabric", "wood"], mediaConsole: ["wood", "metal"], pouf: ["fabric", "wood"], rug: ["fabric"],
  consoleTable: ["wood", "metal"],
  bed: ["fabric", "wood"], nightstand: ["wood", "metal"], dresser: ["wood", "metal"], wardrobe: ["wood", "metal"],
  mirror: ["wood"], bench: ["fabric", "wood"], tableLamp: ["metal"],
  diningTable: ["wood"], diningChair: ["fabric", "wood"], sideboard: ["wood", "metal"], barStool: ["wood", "metal"],
  desk: ["wood", "metal"], officeChair: ["fabric", "metal"],
};
