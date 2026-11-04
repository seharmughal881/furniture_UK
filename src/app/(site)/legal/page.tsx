import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Privacy & terms" };

export default function LegalPage() {
  return (
    <main>
      <article className="section page prose">
        <p className="label">Legal</p>
        <h1>Privacy &amp; terms</h1>
        <p className="demo-banner" role="note">
          Draft text for the new site. It must be reviewed by an Omani lawyer and completed with the company&apos;s legal
          name, commercial registration and e-commerce licence numbers before launch.
        </p>

        <h2 id="who">Who we are</h2>
        <p>
          {COMPANY.tradingName} ({COMPANY.tradingNameAr}) — {COMPANY.legalName}, commercial registration{" "}
          {COMPANY.crNumber}, e-commerce licence {COMPANY.licenceNumber}, VAT registration {COMPANY.vatNumber}.
          Head office: {COMPANY.address}. Email {COMPANY.email}, telephone {COMPANY.phone}.
        </p>

        <h2 id="privacy">Privacy</h2>
        <p>
          We collect the details you give us — name, phone number, delivery address and, if you choose, email — to
          process and deliver your order, answer your questions and, only if you subscribe, send offers. We share them
          only with our delivery team. We never sell your data. To see, correct or delete your data, email{" "}
          {COMPANY.email}.
        </p>

        <h2 id="terms">Terms of sale</h2>
        <ul>
          <li>Prices are in Omani rials and include VAT at 5%.</li>
          <li>Placing an order is an offer to buy; we confirm it by phone or WhatsApp before delivery.</li>
          <li>Delivery and returns are as described on our delivery &amp; returns page.</li>
          <li>Payment is cash on delivery unless agreed otherwise.</li>
          <li>These terms are governed by the laws of the Sultanate of Oman, including the Consumer Protection Law.</li>
        </ul>

        <h2 id="cookies">Cookies</h2>
        <p>
          We use one cookie, <code>atelier_cart</code>, to remember your basket. We don&apos;t use advertising or
          tracking cookies.
        </p>
      </article>
      <Footer />
    </main>
  );
}
