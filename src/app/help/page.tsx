import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { COMPANY } from "@/lib/company";
import { formatPrice, SHIPPING } from "@/lib/types";

export const metadata: Metadata = {
  title: "Delivery, returns & guarantee",
  description:
    "UK delivery to every postcode, your 14-day right to cancel, our 100-night home trial, faulty goods, the lifetime frame guarantee and recycling old electricals.",
};

export default function HelpPage() {
  return (
    <main>
      <article className="section page prose">
        <p className="label">Help</p>
        <h1>Delivery, returns &amp; guarantee</h1>

        <h2 id="delivery">Delivery</h2>
        <p>
          We deliver to every address in the United Kingdom — England, Scotland, Wales and Northern Ireland, including
          the Scottish Highlands and islands — at the same price. There are no postcode surcharges.
        </p>
        <ul>
          <li>
            <b>{SHIPPING.standard.label}</b> — {SHIPPING.standard.note}. {formatPrice(SHIPPING.standard.cents)}, free on
            orders over {formatPrice(SHIPPING.standard.freeOverCents)}.
          </li>
          <li>
            <b>{SHIPPING.whiteGlove.label}</b> — {SHIPPING.whiteGlove.note}. {formatPrice(SHIPPING.whiteGlove.cents)}.
          </li>
        </ul>
        <p>
          Every piece is made to order. Lead times are shown on each product page and in your basket; we call you to
          book a delivery day once your piece is ready. Unless we agree otherwise, we deliver within 30 days of the date
          we tell you, as required by the Consumer Rights Act 2015.
        </p>
        <p>All prices include VAT at 20%. The delivery charge is shown on every product page and before you order.</p>

        <h2 id="returns">Cancelling &amp; returns</h2>
        <h3>Your 14-day right to cancel</h3>
        <p>
          Under the Consumer Contracts Regulations 2013 you can cancel an online order for any reason up to 14 days after
          the day your furniture is delivered. Tell us by email at {COMPANY.email} — you can use the model cancellation
          form or any clear statement. We refund the price and standard delivery within 14 days of collecting the item
          or of you showing that you have sent it back.
        </p>
        <h3>Made-to-order and personalised pieces</h3>
        <p>
          The law allows a retailer to exclude goods made to the customer&apos;s specifications or clearly personalised
          from the 14-day right (regulation 28(1)(b)). We choose not to rely on that for our standard sizes and
          catalogue fabrics. It does apply to genuinely bespoke work, such as custom sizes or customer&apos;s own
          material, and we always tell you before you order.
        </p>
        <h3>100-night home trial</h3>
        <p>
          On top of your legal rights, live with your piece for up to 100 nights. If it isn&apos;t right, we collect it
          free and refund you in full once it&apos;s back in the workshop, provided it&apos;s in the condition we
          delivered it.
        </p>
        <h3>If something is faulty</h3>
        <p>
          The Consumer Rights Act 2015 says goods must be of satisfactory quality, fit for purpose and as described. If
          they are not, you can reject them for a full refund within 30 days of delivery. After 30 days we will repair or
          replace them, and if that doesn&apos;t fix the problem you are entitled to a refund or price reduction.
        </p>
        <p>
          <b>None of this affects your statutory rights.</b> For free, independent advice contact Citizens Advice
          (England and Wales), Advice Direct Scotland or Consumerline (Northern Ireland).
        </p>

        <h2 id="warranty">Lifetime frame guarantee</h2>
        <p>
          Our frames and joinery are guaranteed for as long as you own the piece. Upholstery and finishes are covered for
          five years against manufacturing faults, and we offer re-upholstery at cost for life. The guarantee is in
          addition to your legal rights.
        </p>

        <h2 id="fire">Fire safety</h2>
        <p>
          All our upholstered furniture meets the Furniture and Furnishings (Fire) (Safety) Regulations 1988 (as amended)
          and carries a permanent label. Please don&apos;t remove it — it shows the piece complies.
        </p>

        <h2 id="weee">Recycling your old electricals</h2>
        <p>
          When you buy a lamp from us, we take back an old lamp of the same type free of charge, under the Waste
          Electrical and Electronic Equipment (WEEE) Regulations 2013. Hand it to our delivery team, or tell us within 28
          days of delivery and we&apos;ll arrange a collection. Please don&apos;t put electricals in your household bin —
          the crossed-out wheelie bin symbol means they must be recycled separately. Find your nearest recycling point at
          recycleyourelectricals.org.uk.
        </p>

        <h2 id="care">Care guides</h2>
        <p>
          Each product page lists specific care for its materials. In general: keep timber away from radiators, blot
          spills on fabric straight away, and re-oil solid wood once a year.
        </p>
      </article>
      <Footer />
    </main>
  );
}
