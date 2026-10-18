import Link from "next/link";
import { ROOMS } from "@/lib/catalog-data";
import { COMPANY } from "@/lib/company";
import { Newsletter } from "./Newsletter";

export function Footer() {
  return (
    <footer className="footer" id="visit">
      <div className="footer-top">
        <div className="footer-big">
          Made slowly,
          <br />
          <em>shown honestly.</em>
        </div>
        <Newsletter />
      </div>
      <div className="footer-cols">
        <div>
          <p className="label">Shop</p>
          <Link href="/shop">All furniture</Link>
          {ROOMS.map((r) => (
            <Link key={r.slug} href={`/shop?room=${r.slug}`}>
              {r.name}
            </Link>
          ))}
        </div>
        <div>
          <p className="label">Help</p>
          <Link href="/help#delivery">Delivery</Link>
          <Link href="/help#returns">Returns &amp; 100-night trial</Link>
          <Link href="/help#warranty">Lifetime guarantee</Link>
          <Link href="/help#care">Care guides</Link>
          <Link href="/help#weee">Recycling old electricals</Link>
        </div>
        <div>
          <p className="label">Studio</p>
          <p>
            14 Carpenter&apos;s Yard
            <br />
            Open Thu–Sun, 10–18
          </p>
          <Link href="/planner">Room planner</Link>
        </div>
        <div>
          <p className="label">Legal</p>
          <Link href="/legal#privacy">Privacy policy</Link>
          <Link href="/legal#terms">Terms of sale</Link>
          <Link href="/legal#cookies">Cookies</Link>
        </div>
      </div>
      <address className="company">
        {COMPANY.tradingName} is a trading name of {COMPANY.legalName}, registered in {COMPANY.registeredIn}, company
        number {COMPANY.companyNumber}. Registered office: {COMPANY.registeredOffice}. VAT number {COMPANY.vatNumber}.
        Contact: {COMPANY.email} · {COMPANY.phone}.
        {COMPANY.isPlaceholder && <b> (Placeholder details — replace before launch.)</b>}
      </address>
      <div className="footer-fine">
        <span>© 2026 {COMPANY.tradingName}. All prices in GBP and include VAT.</span>
        <span>Every product on this site is rendered live in your browser with three.js.</span>
      </div>
    </footer>
  );
}
