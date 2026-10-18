import { getMaterials, getProducts } from "@/lib/catalog";

export async function GET() {
  const [products, materials] = await Promise.all([getProducts(), getMaterials()]);
  return Response.json({ products, materials });
}
