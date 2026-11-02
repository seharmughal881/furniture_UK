import { FOOTPRINT, HEIGHT, type FurnitureKind } from "./furniture";

export function frameFor(kind: FurnitureKind, zoom = 1) {
  const [w] = FOOTPRINT[kind];
  const h = HEIGHT[kind];
  const dist = (Math.max(w * 1.05, h * 1.25) * 2.05 + 0.6) * zoom;
  const dir = [0.75, 0.42, 1].map((v) => v / Math.hypot(0.75, 0.42, 1));
  return {
    position: [dir[0] * dist, h / 2 + dir[1] * dist, dir[2] * dist] as [number, number, number],
    target: [0, h * 0.45, 0] as [number, number, number],
  };
}
