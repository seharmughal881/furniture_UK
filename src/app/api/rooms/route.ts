import { pool } from "@/lib/db";
import { badRequest, roomSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { rows } = await pool.query(
    `INSERT INTO rooms (name, layout) VALUES ($1, $2::jsonb) RETURNING id, name, layout, updated_at AS "updatedAt"`,
    [parsed.data.name, JSON.stringify(parsed.data.layout)],
  );
  return Response.json({ room: rows[0] }, { status: 201 });
}
