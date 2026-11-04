import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";
import { newToken } from "@/lib/tokens";
import { badRequest, roomSchema } from "@/lib/validation";

/**
 * Saves a room layout from the planner and returns a share link.
 *
 * The returned editToken is the only thing that may later overwrite this room. The share
 * link (the id) is handed out to other people by design, so the id alone must not grant
 * write access — see the PUT in ./[id]/route.ts. Only the token's hash is stored.
 *
 * Rate limited because this endpoint writes an unbounded row for anyone who asks.
 */

const PER_DAY = 30;
const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);

  const quota = await hit(bucketFor("room:create", callerIp(await headers())), PER_DAY, DAY_SECONDS);
  if (!quota.ok) {
    return Response.json(
      { error: "You have saved a lot of rooms today. Please try again tomorrow." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const { token, hash } = newToken();
  const { rows } = await pool.query(
    `INSERT INTO rooms (name, layout, style, edit_token_hash) VALUES ($1, $2::jsonb, $3::jsonb, $4)
     RETURNING id, name, layout, style, updated_at AS "updatedAt"`,
    [parsed.data.name, JSON.stringify(parsed.data.layout), JSON.stringify(parsed.data.style), hash],
  );

  // The token is returned exactly once, here. It is never readable from a GET.
  return Response.json({ room: rows[0], editToken: token }, { status: 201 });
}
