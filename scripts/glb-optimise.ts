/**
 * Shrinks a GLB to something a browser can actually load in a room planner.
 *
 * Why this exists: generated models are built for inspection, not for a page that may hold
 * a dozen of them at once. A real example from this project measured 16.9 MB -- 282,718
 * triangles (9.3 MB) and two full-size PNG textures (7.6 MB) -- for one sofa. At 183
 * placeable products that is roughly 3 GB, which is not a catalogue anyone can ship.
 *
 * Four steps, in the order that matters:
 *   1. dedup + prune + flatten/join -- drop repeated and unreferenced data first, so the
 *      later (expensive) steps never run on anything that is about to be thrown away.
 *   2. weld + simplify -- the big geometry win. A planner piece is a metre or two away on
 *      screen; a quarter of a million triangles is invisible detail.
 *   3. textureCompress -- resize to at most MAX_TEXTURE px and re-encode as WebP.
 *   4. meshopt -- quantise and compress the vertex streams (EXT_meshopt_compression).
 *
 * Step 4 means the reader MUST register a Meshopt decoder. src/three/AiModel.tsx does
 * (GLTFLoader.setMeshoptDecoder); anything else that opens these files has to as well, or
 * it will fail with "no DRACOLoader/MeshoptDecoder instance provided".
 *
 * simplify() is lossy and ratio/error are deliberately conservative: furniture silhouettes
 * are what a customer judges, so it is better to leave triangles on the table than to
 * round off the arm of a sofa.
 */
import { Document, NodeIO, type Transform } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

/** Longest edge a texture may keep. 1024 is plenty for a piece viewed across a room. */
const MAX_TEXTURE = 1024;
/** Keep at most this share of the original triangles. */
const SIMPLIFY_RATIO = 0.25;
/** Allowed deviation from the original surface, as a fraction of the model's size. */
const SIMPLIFY_ERROR = 0.001;
/** Below this there is nothing worth simplifying, and simplify() on a tiny mesh can distort it. */
const SIMPLIFY_FLOOR = 20_000;

export type OptimiseResult = {
  before: number;
  after: number;
  trianglesBefore: number;
  trianglesAfter: number;
  skipped?: string;
};

function triangleCount(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute("POSITION");
      n += Math.floor((indices?.getCount() ?? position?.getCount() ?? 0) / 3);
    }
  }
  return n;
}

/**
 * Reads `input`, optimises it and writes `output` (which may be the same path).
 *
 * Returns the sizes so a caller can report them. If optimisation would make the file
 * bigger -- which happens with meshes that are already small and tightly packed -- the
 * original bytes are written through unchanged and `skipped` says why.
 */
export async function optimiseGlb(input: Uint8Array): Promise<{ data: Uint8Array } & OptimiseResult> {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO().registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression]).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });

  const doc = await io.readBinary(input);
  const trianglesBefore = triangleCount(doc);

  const steps: Transform[] = [
    dedup(),
    flatten(),
    join(),
    prune({ keepAttributes: false, keepLeaves: false }),
  ];

  // weld() merges vertices that only differ by floating-point noise; simplify() cannot do
  // anything useful on an unwelded mesh, because no two triangles share a vertex.
  if (trianglesBefore >= SIMPLIFY_FLOOR) {
    steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_RATIO, error: SIMPLIFY_ERROR }));
  }

  steps.push(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [MAX_TEXTURE, MAX_TEXTURE] }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );

  await doc.transform(...steps);

  const data = await io.writeBinary(doc);
  const result = {
    before: input.byteLength,
    after: data.byteLength,
    trianglesBefore,
    trianglesAfter: triangleCount(doc),
  };

  // Compression is not guaranteed to win. Never hand back something larger than we got.
  if (data.byteLength >= input.byteLength) {
    return { ...result, data: input, after: input.byteLength, trianglesAfter: trianglesBefore, skipped: "already small" };
  }
  return { ...result, data };
}

/** "16.9 MB -> 1.4 MB (92% smaller)" */
export function describe(r: OptimiseResult): string {
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (r.skipped) return `${mb(r.before)} (left as is: ${r.skipped})`;
  const saved = Math.round((1 - r.after / r.before) * 100);
  const tris =
    r.trianglesAfter !== r.trianglesBefore
      ? `, ${r.trianglesBefore.toLocaleString()} -> ${r.trianglesAfter.toLocaleString()} triangles`
      : "";
  return `${mb(r.before)} -> ${mb(r.after)} (${saved}% smaller${tris})`;
}
