import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { tokenMatches } from "@/lib/tokens";
import { badRequest, isUuid, roomSchema } from "@/lib/validation";

/**
 * A saved planner room.
 *
 * GET is public: the id *is* the share link, so anyone given one may look at the layout.
 * It deliberately does not select edit_token_hash — nothing about the write capability is
 * readable here.
 *
 * PUT requires the editToken returned when the room was first saved. Without that check
 * the share link would also be a write link: everyone the owner sent their layout to
 * could rename it, replace the furniture, or blank it. A room saved before this column
 * existed has no token and is therefore read-only; the planner saves a copy of it
 * instead, so nothing is lost.
 */

const PER_HOUR = 60;
const HOUR_SECONDS = 60 * 60;

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/rooms/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const { rows } = await pool.query(
    `SELECT id, name, layout, style, updated_at AS "updatedAt" FROM rooms WHERE id = $1`,
    [id],
  );
  return rows[0] ? Response.json({ room: rows[0] }) : notFound();
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/rooms/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();

  const quota = await hit(bucketFor("room:update", callerIp(await headers())), PER_HOUR, HOUR_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "Too many saves. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  // Sent as a header rather than in the body so it stays out of the layout JSON.
  const presented = request.headers.get("x-room-token");
  const { rows: existing } = await pool.query(
    `SELECT edit_token_hash AS "editTokenHash" FROM rooms WHERE id = $1`,
    [id],
  );
  if (!existing[0]) return notFound();

  if (!tokenMatches(presented, existing[0].editTokenHash)) {
    return Response.json(
      { error: "This room can only be changed by whoever saved it. Save your own copy instead." },
      { status: 403 },
    );
  }

  const { rows } = await pool.query(
    `UPDATE rooms SET name = $2, layout = $3::jsonb, style = $4::jsonb, updated_at = now()
     WHERE id = $1 RETURNING id, name, layout, style, updated_at AS "updatedAt"`,
    [id, parsed.data.name, JSON.stringify(parsed.data.layout), JSON.stringify(parsed.data.style)],
  );
  return rows[0] ? Response.json({ room: rows[0] }) : notFound();
}
