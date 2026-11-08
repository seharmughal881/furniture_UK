import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentAdmin } from "@/lib/admin/session";
import { bucketFor, hit } from "@/lib/rate-limit";

/**
 * Issues short-lived tokens for admin image uploads.
 *
 * The browser sends the file straight to Vercel Blob rather than through this route. That
 * is not only faster: a serverless function may not receive a body larger than ~4.5MB, so
 * routing a phone photo through the server would simply fail. This endpoint only decides
 * *whether* an upload may happen, and under what constraints.
 *
 * Deliberately currentAdmin() and not requireAdmin(): requireAdmin() redirects to the
 * login page, which is right for a page but wrong for an API call -- the browser would
 * receive an HTML login page where it expects JSON. A 401 is the honest answer here.
 *
 * The size and media-type limits are set here and encoded into the token Blob issues, so
 * a tampered client cannot raise them.
 */

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

// Raster photographs only. No SVG: an SVG is a document that can carry script, and these
// files end up in an <img src> on the public storefront.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// Videos, kept to the two formats every browser plays. A video is far larger than a
// photo, so it gets its own ceiling rather than widening the photo limit for everyone.
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;

// 3D models, binary glTF only. A .glb is data, not a document: unlike SVG it carries no
// script. Generated models routinely run to tens of megabytes before optimisation, hence
// the same ceiling as a video.
const ALLOWED_MODEL_TYPES = ["model/gltf-binary"];
const MAX_MODEL_BYTES = 64 * 1024 * 1024;

const UPLOAD_LIMIT = 120;
const UPLOAD_WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request): Promise<Response> {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not signed in." }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Image storage is not set up yet. Add BLOB_READ_WRITE_TOKEN from Vercel → Storage → Blob." },
      { status: 503 },
    );
  }

  // Bucketed on the signed-in account rather than the IP, because staff share an office
  // connection and would otherwise exhaust one another's quota.
  const quota = await hit(bucketFor("admin:upload", String(admin.id)), UPLOAD_LIMIT, UPLOAD_WINDOW_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Too many uploads in the last hour. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "Bad request." }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request,
      // The client says which kind of file it is about to send. That only ever chooses
      // between two fixed allow-lists -- it can never name a type of its own -- and the
      // choice is baked into the token Blob issues, so the limits hold server-side.
      onBeforeGenerateToken: async (_pathname, clientPayload) => ({
        allowedContentTypes:
          clientPayload === "video" ? ALLOWED_VIDEO_TYPES
          : clientPayload === "model" ? ALLOWED_MODEL_TYPES
          : ALLOWED_TYPES,
        maximumSizeInBytes:
          clientPayload === "video" ? MAX_VIDEO_BYTES
          : clientPayload === "model" ? MAX_MODEL_BYTES
          : MAX_UPLOAD_BYTES,
        // Two people uploading "sofa.jpg" must not overwrite each other, and a replaced
        // photo must get a new URL or the old one lingers in browser and CDN caches.
        addRandomSuffix: true,
      }),
      // Nothing to do on completion: the returned URL is written into products.images by
      // the form the admin then submits, so an upload nobody saves stays unreferenced.
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (err) {
    // handleUpload throws on a malformed body, a rejected media type or an oversized file.
    const message = err instanceof Error ? err.message : "Upload failed.";
    console.error(`[admin upload] ${admin.email}: ${message}`);
    return Response.json({ error: message }, { status: 400 });
  }
}
