// Reads a product photo in the browser and works out how the 3D stand-in should look:
// the main upholstery colour, the wood/leg colour, and whether the photo is a cut-out on
// a white background (so it can be shown as a "real photo" in the room).
import type { Palette } from "@/lib/types";

export type ProductLook = {
  palette: Palette;
  /** true when the photo is the product alone on a plain white background */
  cutout: boolean;
  /** width / height of the photo */
  aspect: number;
  /** a clearly different second colour (e.g. contrasting armchairs in a sofa set), if any */
  accent: string | null;
};

const cache = new Map<string, Promise<ProductLook | null>>();

const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const isBackground = (r: number, g: number, b: number) => r > 232 && g > 232 && b > 232;

export function analyseProductImage(url: string): Promise<ProductLook | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  const job = new Promise<ProductLook | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const S = 96;
        const c = document.createElement("canvas");
        c.width = c.height = S;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, S, S);
        const k = Math.min(S / img.width, S / img.height);
        const w = img.width * k;
        const h = img.height * k;
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        const { data } = ctx.getImageData(0, 0, S, S);

        // cut-out check: is the photo's own border almost all white?
        const x0 = Math.ceil((S - w) / 2) + 1;
        const y0 = Math.ceil((S - h) / 2) + 1;
        const x1 = Math.floor((S + w) / 2) - 2;
        const y1 = Math.floor((S + h) / 2) - 2;
        let border = 0;
        let white = 0;
        const px = (x: number, y: number) => {
          const i = (y * S + x) * 4;
          return [data[i], data[i + 1], data[i + 2]] as const;
        };
        for (let x = x0; x <= x1; x += 2) {
          for (const y of [y0, y1]) {
            border++;
            if (isBackground(...px(x, y))) white++;
          }
        }
        for (let y = y0; y <= y1; y += 2) {
          for (const x of [x0, x1]) {
            border++;
            if (isBackground(...px(x, y))) white++;
          }
        }
        const cutout = border > 0 && white / border > 0.85;

        // colour buckets over the product (cut-outs: everything not white; room photos: the centre)
        const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
        const inset = cutout ? 0 : 0.22;
        for (let y = Math.floor(y0 + h * inset); y < y1 - h * inset; y++) {
          for (let x = Math.floor(x0 + w * inset); x < x1 - w * inset; x++) {
            const [r, g, b] = px(x, y);
            if (cutout && isBackground(r, g, b)) continue;
            const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
            const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
            e.n++;
            e.r += r;
            e.g += g;
            e.b += b;
            buckets.set(key, e);
          }
        }
        const colours = [...buckets.values()]
          .filter((e) => e.n > 3)
          .map((e) => ({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }))
          .map((e) => ({ ...e, l: lum(e.r, e.g, e.b) }))
          .sort((a, b) => b.n - a.n);

        // upholstery = most common colour that isn't a deep shadow
        const fabric = colours.find((c) => c.l > 0.22) ?? colours[0];
        // wood/legs = most common clearly darker colour
        const wood = colours.find((c) => fabric && c.l < fabric.l - 0.18 && c.l < 0.5);
        // second upholstery colour: common, clearly different from the first, and not plain wood-brown
        const dist = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
          Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
        const total = colours.reduce((s, c) => s + c.n, 0);
        const accent = colours.find(
          (c) =>
            fabric &&
            c !== fabric &&
            c.n > total * 0.04 &&
            dist(c, fabric) > 90 &&
            (!wood || dist(c, wood) > 45) &&
            Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 18, // has some colour, not grey/white
        );
        resolve({
          palette: {
            fabric: fabric ? hex(fabric.r, fabric.g, fabric.b) : "#e8e0d2",
            wood: wood ? hex(wood.r, wood.g, wood.b) : "#6b4a33",
            metal: "#2b2b2b",
          },
          cutout,
          aspect: img.width / img.height,
          accent: accent ? hex(accent.r, accent.g, accent.b) : null,
        });
      } catch {
        resolve(null); // canvas blocked (no CORS) — callers fall back to defaults
      }
    };
    img.src = url;
  });
  cache.set(url, job);
  return job;
}
