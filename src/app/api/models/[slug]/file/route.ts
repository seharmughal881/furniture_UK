import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { modelFileName, MODELS_DIR } from "@/lib/models3d";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/models/[slug]/file">) {
  const { slug } = await ctx.params;
  const name = await modelFileName(slug);
  if (!name || !/^[a-z0-9-]+$/.test(name)) return new Response("Not found", { status: 404 });
  const bin = await readFile(join(MODELS_DIR, `${name}.glb`)).catch(() => null);
  if (!bin) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bin), {
    headers: {
      "Content-Type": "model/gltf-binary",
      // the file name changes whenever a model is regenerated, so it can be cached for long
      "Cache-Control": "public, max-age=86400",
    },
  });
}
