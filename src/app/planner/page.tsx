import type { Metadata } from "next";
import { Suspense } from "react";
import { Planner } from "@/components/planner/Planner";
import { getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Room planner",
  description: "Arrange Atelier furniture in a live 3D room, change the time of day, and save a shareable layout.",
};

export default async function PlannerPage() {
  const products = await getProducts();
  return (
    <Suspense fallback={<main className="planner" />}>
      <Planner products={products} />
    </Suspense>
  );
}
