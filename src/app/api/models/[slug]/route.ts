import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getModelState, requestModel } from "@/lib/models3d";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";

/**
 * GET: current state (and advances a finished job). POST: start generating if there is no
 * model yet.
 *
 * POST is unauthenticated and costs money (fal.ai bills per generation). MAX_3D_PER_DAY
 * already caps the spend, but without a per-caller limit one script can exhaust the whole
 * day's quota across different slugs and deny the feature to real visitors -- so this
 * matches the per-IP bucket every other public write endpoint in the project uses.
 */
const PER_DAY = 15;
const DAY_SECONDS = 24 * 60 * 60;

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/models/[slug]">) {
  const { slug } = await ctx.params;
  return Response.json(await getModelState(slug));
}

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/models/[slug]">) {
  const { slug } = await ctx.params;

  const quota = await hit(bucketFor("model:create", callerIp(await headers())), PER_DAY, DAY_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { status: "unavailable", reason: "too many 3D requests from this connection today" },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  return Response.json(await requestModel(slug));
}
