import type { Metadata } from "next";
import { Suspense } from "react";
import { Planner } from "@/components/planner/Planner";
import { getProductIndex } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Room planner",
  description: "Arrange Muscat Furniture sofa sets, bedroom sets and dining in a live 3D room, change the time of day, and save a shareable layout.",
};

export default async function PlannerPage() {
  // only products with a 3D model can be placed in the room
  const products = (await getProductIndex()).filter((p) => p.kind);
  return (
    <Suspense fallback={<main className="planner" />}>
      <Planner products={products} />
    </Suspense>
  );
}
