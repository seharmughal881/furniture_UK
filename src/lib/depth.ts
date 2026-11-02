import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import type { DepthInfo } from "./types";

export type { DepthInfo };

/** The depth map for a product's main photo, if one was made (npm run depth:make). */
export async function getDepth(slug: string): Promise<(DepthInfo & { src: string }) | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  try {
    const index: Record<string, DepthInfo> = JSON.parse(await readFile(join(process.cwd(), "public", "depth", "index.json"), "utf8"));
    return index[slug] ? { ...index[slug], src: `/depth/${slug}.png` } : null;
  } catch {
    return null;
  }
}
