import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Privacy, terms & cookies" };

export default function LegalPage() {
  return (
    <main>
      <article className="section page prose">
        <p className="label">Legal</p>
        <h1>Privacy, terms &amp; cookies</h1>
        <p className="demo-banner" role="note">
          Draft text for the demo, written to UK requirements. It must be reviewed by a UK solicitor and completed with
          the real company details before launch.
        </p>

        <h2 id="who">Who we are</h2>
        <p>
          {COMPANY.tradingName} is a trading name of {COMPANY.legalName}, a company registered in {COMPANY.registeredIn}{" "}
          with company number {COMPANY.companyNumber}. Registered office: {COMPANY.registeredOffice}. VAT number{" "}
          {COMPANY.vatNumber}. Email {COMPANY.email}, telephone {COMPANY.phone}.
        </p>

        <h2 id="privacy">Privacy notice</h2>
        <p>
          We are the controller of your personal data under the UK GDPR and the Data Protection Act 2018. We collect the
          details you give us — name, email, delivery address, phone number — to make and deliver your furniture
          (contract), to answer quote requests (legitimate interests) and, only if you subscribe, to send our newsletter
          (consent; unsubscribe at any time). We keep order records for six years for tax purposes. We never sell your
          data. We share it only with our delivery partners and payment provider, to fulfil your order.
        </p>
        <p>
          You have the right to access, correct, delete or move your data, and to object to how we use it. Email{" "}
          {COMPANY.email}. If you are unhappy with how we handle your data, you can complain to the Information
          Commissioner&apos;s Office (ico.org.uk).
        </p>

        <h2 id="terms">Terms of sale</h2>
        <ul>
          <li>Prices are in pounds sterling and include VAT at 20%. Delivery charges are shown before you order.</li>
          <li>
            When you press &ldquo;Order with obligation to pay&rdquo; you make an offer to buy. A contract is formed when
            we confirm your order by email.
          </li>
          <li>
            Made-to-order lead times are estimates. We deliver within 30 days of the date we give you unless we agree
            otherwise; if we can&apos;t, you may cancel for a full refund.
          </li>
          <li>
            You can cancel within 14 days of delivery under the Consumer Contracts Regulations 2013. See{" "}
            <a href="/help#returns">cancelling &amp; returns</a>.
          </li>
          <li>Your rights under the Consumer Rights Act 2015 are not affected.</li>
          <li>These terms are governed by the law of England and Wales; you may also bring a claim in the courts of Scotland or Northern Ireland if you live there.</li>
        </ul>

        <h2 id="cookies">Cookies</h2>
        <p>
          We use one cookie, <code>atelier_cart</code>, to remember what is in your basket. It is strictly necessary for
          the shopping service you ask for, so under the Privacy and Electronic Communications Regulations (PECR) it does
          not need your consent. We do not use analytics, advertising or third-party cookies. If we add any in future, we
          will ask for your consent first.
        </p>
      </article>
      <Footer />
    </main>
  );
}
