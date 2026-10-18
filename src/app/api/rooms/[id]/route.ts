import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { badRequest, isUuid, roomSchema } from "@/lib/validation";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/rooms/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const { rows } = await pool.query(
    `SELECT id, name, layout, updated_at AS "updatedAt" FROM rooms WHERE id = $1`,
    [id],
  );
  return rows[0] ? Response.json({ room: rows[0] }) : notFound();
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/rooms/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { rows } = await pool.query(
    `UPDATE rooms SET name = $2, layout = $3::jsonb, updated_at = now()
     WHERE id = $1 RETURNING id, name, layout, updated_at AS "updatedAt"`,
    [id, parsed.data.name, JSON.stringify(parsed.data.layout)],
  );
  return rows[0] ? Response.json({ room: rows[0] }) : notFound();
}
