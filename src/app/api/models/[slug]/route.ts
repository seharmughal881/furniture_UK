import type { NextRequest } from "next/server";
import { getModelState, requestModel } from "@/lib/models3d";

// GET: current state (and advances a finished job). POST: start generating if there is no model yet.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/models/[slug]">) {
  const { slug } = await ctx.params;
  return Response.json(await getModelState(slug));
}

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/models/[slug]">) {
  const { slug } = await ctx.params;
  return Response.json(await requestModel(slug));
}
