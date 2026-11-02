// Works out which 3D pieces make up a product from its name, so that
// "Dublin Sofa 3+3+1+1" places two sofas and two armchairs, a bedroom set places a bed,
// nightstands, wardrobe and dresser, and "dining table +6 chairs" places a table with 6 chairs.
import { FOOTPRINT, type FurnitureKind } from "./furniture";

export type SetPiece = { kind: FurnitureKind; x: number; z: number; rot: number; scaleX?: number };

const PI = Math.PI;

function sofaSet(seats: number[]): SetPiece[] {
  // biggest at the back, then left, right and front, all facing the middle
  const spots = [
    { x: 0, z: -1.35, rot: 0 },
    { x: -1.55, z: 0, rot: PI / 2 },
    { x: 1.55, z: 0, rot: -PI / 2 },
    { x: 0, z: 1.35, rot: PI },
    { x: -1.55, z: 1.2, rot: PI / 2 },
    { x: 1.55, z: 1.2, rot: -PI / 2 },
  ];
  const sorted = [...seats].sort((a, b) => b - a).slice(0, spots.length);
  const pieces: SetPiece[] = sorted.map((n, i) => {
    const s = spots[i];
    if (n <= 1) return { kind: "armchair", ...s };
    return { kind: "sofa", ...s, scaleX: n === 2 ? 0.72 : 1 };
  });
  pieces.push({ kind: "coffeeTable", x: 0, z: 0, rot: 0 });
  return pieces;
}

function diningSet(chairs: number): SetPiece[] {
  const pieces: SetPiece[] = [{ kind: "diningTable", x: 0, z: 0, rot: 0 }];
  const perSide = Math.min(3, Math.ceil(Math.min(chairs, 6) / 2));
  const xs = perSide === 1 ? [0] : perSide === 2 ? [-0.45, 0.45] : [-0.6, 0, 0.6];
  let placed = 0;
  for (const x of xs) {
    if (placed++ < chairs) pieces.push({ kind: "diningChair", x, z: -0.62, rot: 0 });
    if (placed++ < chairs) pieces.push({ kind: "diningChair", x, z: 0.62, rot: PI });
  }
  return pieces;
}

const BEDROOM_SET: SetPiece[] = [
  { kind: "bed", x: 0, z: 0, rot: 0 },
  { kind: "nightstand", x: -1.15, z: -0.86, rot: 0 },
  { kind: "nightstand", x: 1.15, z: -0.86, rot: 0 },
  { kind: "wardrobe", x: 2.05, z: 0.1, rot: -PI / 2 },
  { kind: "dresser", x: -2.0, z: 0.4, rot: PI / 2 },
];

/** Pieces for a product, positioned around the product's own origin. Single products return one piece. */
export function compositionFor(name: string, kind: FurnitureKind): SetPiece[] {
  const n = name.toLowerCase();
  const seats = name.match(/\b(\d)(?:\s*\+\s*(\d))+\b/);
  if (kind === "sofa" || kind === "armchair") {
    if (seats) return sofaSet(seats[0].split("+").map((s) => parseInt(s, 10)));
    if (/sofa set|seater set/.test(n)) return sofaSet(/8 person|8 seat/.test(n) ? [3, 3, 1, 1] : [3, 2, 1]);
  }
  if (kind === "bed" && /bedroom set/.test(n)) return BEDROOM_SET;
  const chairs = n.match(/\+\s*(\d+)\s*chairs?/);
  if ((kind === "diningTable" || kind === "diningChair") && chairs) return diningSet(parseInt(chairs[1], 10));
  if (kind === "bed" && /two side ?stands|2 side ?stands|with nightstands/.test(n))
    return BEDROOM_SET.slice(0, 3);
  return [{ kind, x: 0, z: 0, rot: 0 }];
}

/** Width and depth (metres) of the area a composition covers, for the selection outline. */
export function compositionFootprint(pieces: SetPiece[]): [number, number, number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pieces) {
    const [w0, d0] = FOOTPRINT[p.kind];
    const w = w0 * (p.scaleX ?? 1);
    const quarter = Math.round(p.rot / (PI / 2)) % 2 !== 0;
    const hw = (quarter ? d0 : w) / 2;
    const hd = (quarter ? w : d0) / 2;
    minX = Math.min(minX, p.x - hw);
    maxX = Math.max(maxX, p.x + hw);
    minZ = Math.min(minZ, p.z - hd);
    maxZ = Math.max(maxZ, p.z + hd);
  }
  // [width, depth, centreX, centreZ]
  return [maxX - minX, maxZ - minZ, (minX + maxX) / 2, (minZ + maxZ) / 2];
}
