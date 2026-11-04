import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { COMPANY } from "@/lib/company";
import { DELIVERY, formatPrice } from "@/lib/types";

export const metadata: Metadata = {
  title: "Delivery, returns & payment",
  description: "Delivery across Oman in 4–6 days, free over OMR 75. Returns within 15 days. Cash on delivery.",
};

// Based on the policies published on muscatfurniture.com (shipping and refund policy, October 2026).
export default function HelpPage() {
  return (
    <main>
      <article className="section page prose">
        <p className="label">Help</p>
        <h1>Delivery, returns &amp; payment</h1>

        <h2 id="delivery">Delivery across Oman</h2>
        <ul>
          <li>We deliver to physical addresses anywhere in Oman. We don&apos;t deliver to P.O. boxes or outside Oman.</li>
          <li>
            Your order arrives within <b>{DELIVERY.days}</b> of ordering. Our delivery days are {DELIVERY.businessDays}.
            Times are approximate and can vary by location.
          </li>
          <li>
            <b>Free delivery on orders over {formatPrice(DELIVERY.freeOverCents)}.</b> For smaller orders the fee
            depends on the size, weight and destination; we confirm it with you by phone before dispatch.
          </li>
          <li>We call or WhatsApp you to book a delivery time.</li>
        </ul>

        <h2 id="returns">Returns &amp; exchanges</h2>
        <ul>
          <li>You can return items within <b>15 days</b> of purchase.</li>
          <li>Items must be unused, unassembled and undamaged, in their original packaging, with your receipt or order confirmation.</li>
          <li>
            Assembled furniture, customised or made-to-order items, and clearance or sale items can&apos;t be returned
            unless they are faulty.
          </li>
          <li>You arrange and pay for the return delivery.</li>
          <li>
            Approved returns can be exchanged for an eligible item of equal value. Refunds are processed within 4–6
            business days of approval.
          </li>
        </ul>

        <h2 id="damaged">Faulty or damaged items</h2>
        <p>
          Please contact us within 48 hours of delivery on {COMPANY.phone} or {COMPANY.complaintsEmail}, with photos
          if possible. Faulty items are covered whatever the category.
        </p>

        <h2 id="payment">Payment</h2>
        <p>
          Pay <b>cash on delivery</b>. All prices are in Omani rials and include 5% VAT. You can also order directly on{" "}
          <a href={`https://wa.me/${COMPANY.whatsapp}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          or at any of our <Link href="/stores">showrooms</Link>.
        </p>
      </article>
      <Footer />
    </main>
  );
}
