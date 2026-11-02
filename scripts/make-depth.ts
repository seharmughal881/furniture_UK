// Makes a depth map for every product's main photo, for the "pop-up 3D photo" on product pages.
//   npm run depth:make            -> public/depth/<slug>.png + public/depth/index.json (skips done ones)
//   npm run depth:make -- --all   -> redo every product
// Each PNG is grey = depth (white = nearest) with alpha = the product (white studio background removed).
// Model: Depth Anything V2 Small (Apache-2.0), run on the CPU with transformers.js.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline, RawImage } from "@huggingface/transformers";
import { Pool } from "pg";
import sharp from "sharp";
import { shopifyImage } from "../src/lib/images";
import type { DepthInfo } from "../src/lib/types";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const OUT = join(__dirname, "..", "public", "depth");
const INDEX = join(OUT, "index.json");
const SIZE = 512;

/** Same rule as src/three/cutout.ts: only studio white connected to the photo's edge is background. */
function backgroundMask(rgb: Buffer, W: number, H: number) {
  const bg = new Uint8Array(W * H);
  const isBg = (p: number) => {
    const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2];
    return r > 246 && g > 246 && b > 246 && Math.max(r, g, b) - Math.min(r, g, b) < 8;
  };
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * W + x;
    if (!bg[p] && isBg(p)) {
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
  // a "cut-out" photo has most of its border on white; room photos keep their background
  let edge = 0;
  let white = 0;
  const count = (p: number) => {
    edge++;
    white += bg[p];
  };
  for (let x = 0; x < W; x++) {
    count(x);
    count((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    count(y * W);
    count(y * W + W - 1);
  }
  return { bg, cut: white / edge > 0.6 };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ slug: string; image: string }>(
    `SELECT slug, images[1] AS image FROM products WHERE active AND images[1] IS NOT NULL ORDER BY sort_order, id`,
  );
  await pool.end();

  mkdirSync(OUT, { recursive: true });
  const index: Record<string, DepthInfo> =
    existsSync(INDEX) && !process.argv.includes("--all") ? JSON.parse(readFileSync(INDEX, "utf8")) : {};
  const todo = rows.filter((r) => !index[r.slug] || !existsSync(join(OUT, `${r.slug}.png`)));
  console.log(`${rows.length} products, ${todo.length} to do`);
  if (!todo.length) return;

  const estimate = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", { dtype: "fp32" });
  let n = 0;
  for (const r of todo) {
    n++;
    try {
      const t = Date.now();
      const res = await fetch(shopifyImage(r.image, 800));
      if (!res.ok) throw new Error(`photo HTTP ${res.status}`);
      const { data: rgb, info } = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: SIZE, height: SIZE, fit: "inside" })
        .flatten({ background: "#ffffff" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const W = info.width;
      const H = info.height;

      const out = (await estimate(new RawImage(new Uint8ClampedArray(rgb), W, H, 3))) as unknown as { depth: RawImage };
      let depth = out.depth;
      if (depth.width !== W || depth.height !== H) depth = await depth.resize(W, H);

      const { bg, cut } = backgroundMask(rgb, W, H);
      const px = Buffer.alloc(W * H * 2);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let p = 0; p < W * H; p++) {
        px[p * 2] = depth.data[p * depth.channels];
        const keep = !cut || !bg[p];
        px[p * 2 + 1] = keep ? 255 : 0;
        if (keep) {
          const x = p % W;
          const y = (p - x) / W;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) throw new Error("empty photo");
      await sharp(px, { raw: { width: W, height: H, channels: 2 } })
        .png({ compressionLevel: 9 })
        .toFile(join(OUT, `${r.slug}.png`));
      index[r.slug] = { w: W, h: H, cut, box: [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H] };
      console.log(`[${n}/${todo.length}] ✅ ${r.slug} ${cut ? "(cut-out)" : "(photo)"} ${Date.now() - t}ms`);
    } catch (e) {
      console.log(`[${n}/${todo.length}] ❌ ${r.slug}: ${(e as Error).message}`);
    }
    if (n % 20 === 0) writeFileSync(INDEX, JSON.stringify(index));
  }
  writeFileSync(INDEX, JSON.stringify(index));
  console.log(`Done: ${Object.keys(index).length} depth maps in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
