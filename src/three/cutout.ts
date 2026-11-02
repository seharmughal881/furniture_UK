// Turns a product photo shot on a white studio background into a transparent cut-out.
// Only the white that is connected to the photo's edge is removed (flood fill), so white
// furniture itself stays solid. The result is cropped tight around the product.

export type Cutout = { canvas: HTMLCanvasElement; aspect: number };

const cache = new Map<string, Promise<Cutout | null>>();

export function makeCutout(url: string, max = 640): Promise<Cutout | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  const job = new Promise<Cutout | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const W = Math.round(img.width * k);
        const H = Math.round(img.height * k);
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, W, H);
        const im = ctx.getImageData(0, 0, W, H);
        const d = im.data;

        // background = very light, low-saturation pixels reachable from the border
        const isBg = (i: number) => {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          // strict: studio white only, so the soft grey shading on white furniture is kept
          return r > 246 && g > 246 && b > 246 && Math.max(r, g, b) - Math.min(r, g, b) < 8;
        };
        const bg = new Uint8Array(W * H);
        const stack: number[] = [];
        const push = (x: number, y: number) => {
          const p = y * W + x;
          if (!bg[p] && isBg(p * 4)) {
            bg[p] = 1;
            stack.push(p);
          }
        };
        for (let x = 0; x < W; x++) {
          push(x, 0);
          push(x, H - 1);
        }
        for (let y = 0; y < H; y++) {
          push(0, y);
          push(W - 1, y);
        }
        while (stack.length) {
          const p = stack.pop()!;
          const x = p % W;
          const y = (p - x) / W;
          if (x > 0) push(x - 1, y);
          if (x < W - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1);
          if (y < H - 1) push(x, y + 1);
        }

        // apply alpha with a soft one-pixel edge, and find the product's bounding box
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = y * W + x;
            if (bg[p]) {
              d[p * 4 + 3] = 0;
              continue;
            }
            const edge =
              (x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (y > 0 && bg[p - W]) || (y < H - 1 && bg[p + W]);
            if (edge) d[p * 4 + 3] = 150;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) return resolve(null);
        ctx.putImageData(im, 0, 0);

        const cw = x1 - x0 + 1;
        const ch = y1 - y0 + 1;
        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        out.getContext("2d")!.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
        resolve({ canvas: out, aspect: cw / ch });
      } catch {
        resolve(null);
      }
    };
    img.src = url;
  });
  cache.set(url, job);
  return job;
}
