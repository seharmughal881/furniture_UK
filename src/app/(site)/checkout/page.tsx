import type { Metadata } from "next";
import { Checkout } from "@/components/commerce/Checkout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/**
 * Card payment is offered only once AmwalPay is actually configured. The flag is derived
 * from the merchant id rather than a separate on/off switch, so the option cannot be
 * turned on by accident while the credentials are still missing.
 *
 * This is read at build time, which is right for a deploy-level setting: adding the keys
 * is a deploy anyway. Nothing secret reaches the browser -- only the true/false.
 */
export default function CheckoutPage() {
  const cardEnabled = Boolean(process.env.AMWALPAY_MERCHANT_ID);
  return (
    <main className="section page">
      <Checkout cardEnabled={cardEnabled} />
    </main>
  );
}
