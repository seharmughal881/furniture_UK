import { pool } from "@/lib/db";
import { badRequest, roomSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { rows } = await pool.query(
    `INSERT INTO rooms (name, layout, style) VALUES ($1, $2::jsonb, $3::jsonb)
     RETURNING id, name, layout, style, updated_at AS "updatedAt"`,
    [parsed.data.name, JSON.stringify(parsed.data.layout), JSON.stringify(parsed.data.style)],
  );
  return Response.json({ room: rows[0] }, { status: 201 });
}
