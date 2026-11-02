// Finds the product videos on the client's Shopify store and records them for the shop's category headers.
//   npm run videos:import   -> src/lib/product-videos.json  { [our product slug]: video }
// Only the public storefront is read (/products.json and /products/<handle>.js), slowly, because
// the store rate-limits fast requests. The videos stay on Shopify's CDN; nothing is downloaded.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const STORE = "https://muscatfurniture.com";
const OUT = join(__dirname, "..", "src", "lib", "product-videos.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Source = { format: string; url: string; height: number };
type Media = { media_type: string; duration?: number; preview_image?: { src: string }; sources?: Source[] };

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.status === 429) {
      await sleep(10_000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }
  throw new Error("rate limited");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ slug: string; external_id: string }>(
    "SELECT slug, external_id FROM products WHERE active AND source = 'muscat'",
  );
  await pool.end();
  const slugById = new Map(rows.map((r) => [String(r.external_id), r.slug]));

  // product id -> handle, from the store feed
  const handles: { id: number; handle: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const { products } = await getJson<{ products: { id: number; handle: string }[] }>(
      `${STORE}/products.json?limit=250&page=${page}`,
    );
    if (!products.length) break;
    handles.push(...products);
    await sleep(2000);
  }

  const videos: Record<string, { sd: string; hd: string; poster: string; seconds: number }> = {};
  const todo = handles.filter((p) => slugById.has(String(p.id)));
  console.log(`${todo.length} products to check`);
  for (const [n, p] of todo.entries()) {
    try {
      const { media = [] } = await getJson<{ media?: Media[] }>(`${STORE}/products/${encodeURIComponent(p.handle)}.js`);
      const v = media.find((m) => m.media_type === "video" && m.sources?.length);
      if (v) {
        const mp4 = v.sources!.filter((s) => s.format === "mp4").sort((a, b) => a.height - b.height);
        const sd = mp4.find((s) => s.height >= 480) ?? mp4[0];
        const hd = mp4.find((s) => s.height >= 720) ?? sd;
        if (sd && v.preview_image) {
          const slug = slugById.get(String(p.id))!;
          videos[slug] = { sd: sd.url, hd: hd.url, poster: v.preview_image.src, seconds: Math.round((v.duration ?? 0) / 1000) };
          console.log(`[${n + 1}/${todo.length}] 🎬 ${slug}`);
        }
      }
    } catch (e) {
      console.log(`[${n + 1}/${todo.length}] skipped ${p.handle}: ${(e as Error).message}`);
    }
    await sleep(600);
  }
  writeFileSync(OUT, JSON.stringify(videos, null, 1) + "\n");
  console.log(`Done: ${Object.keys(videos).length} product videos -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
