import { pool } from "@/lib/db";
import { badRequest, newsletterSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = newsletterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  await pool.query("INSERT INTO newsletter (email) VALUES (lower($1)) ON CONFLICT DO NOTHING", [parsed.data.email]);
  return Response.json({ ok: true }, { status: 201 });
}
