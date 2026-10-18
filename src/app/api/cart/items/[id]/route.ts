import type { NextRequest } from "next/server";
import { currentCartId, readCart } from "@/lib/cart";
import { pool } from "@/lib/db";
import { badRequest, updateCartItemSchema } from "@/lib/validation";

async function lineContext(ctx: RouteContext<"/api/cart/items/[id]">) {
  const { id } = await ctx.params;
  const lineId = Number(id);
  const cartId = await currentCartId();
  return Number.isInteger(lineId) && cartId ? { lineId, cartId } : null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/cart/items/[id]">) {
  const c = await lineContext(ctx);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = updateCartItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  // scoped by cart_id so one visitor can never touch another visitor's cart
  if (parsed.data.quantity === 0) {
    await pool.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [c.lineId, c.cartId]);
  } else {
    await pool.query("UPDATE cart_items SET quantity = $3 WHERE id = $1 AND cart_id = $2", [
      c.lineId, c.cartId, parsed.data.quantity,
    ]);
  }
  return Response.json(await readCart(c.cartId));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/cart/items/[id]">) {
  const c = await lineContext(ctx);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  await pool.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [c.lineId, c.cartId]);
  return Response.json(await readCart(c.cartId));
}
