import { currentCartId, readCart } from "@/lib/cart";

export async function GET() {
  return Response.json(await readCart(await currentCartId()));
}
