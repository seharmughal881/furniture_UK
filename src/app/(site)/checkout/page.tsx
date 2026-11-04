import type { Metadata } from "next";
import { Checkout } from "@/components/commerce/Checkout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <main className="section page">
      <Checkout />
    </main>
  );
}
