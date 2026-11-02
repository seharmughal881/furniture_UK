import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog-data";
import { COMPANY } from "@/lib/company";
import { Newsletter } from "./Newsletter";

const SHOWROOM_CITIES = ["Muscat (Al Hail North)", "Sohar", "Barka", "Al-Bidaya", "Nizwa", "Salalah"];

export function Footer() {
  return (
    <footer className="footer" id="visit">
      <div className="footer-top">
        <div className="footer-big">
          See it first,
          <br />
          <em>love it at home.</em>
        </div>
        <Newsletter />
      </div>
      <div className="footer-cols">
        <div>
          <p className="label">Shop</p>
          <Link href="/shop">All products</Link>
          {CATEGORIES.slice(0, 7).map((c) => (
            <Link key={c.slug} href={`/shop?category=${c.slug}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <p className="label">Showrooms</p>
          {SHOWROOM_CITIES.map((c) => (
            <Link key={c} href="/stores">
              {c}
            </Link>
          ))}
        </div>
        <div>
          <p className="label">Help</p>
          <Link href="/help#delivery">Delivery across Oman</Link>
          <Link href="/help#returns">Returns &amp; exchanges</Link>
          <Link href="/help#payment">Cash on delivery</Link>
          <Link href="/planner">Room planner</Link>
        </div>
        <div>
          <p className="label">Contact</p>
          <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</a>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <a href={COMPANY.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={COMPANY.facebook} target="_blank" rel="noopener noreferrer">
            Facebook
          </a>
          <Link href="/legal">Privacy &amp; terms</Link>
        </div>
      </div>
      <address className="company">
        {COMPANY.tradingName} · {COMPANY.legalName} · Commercial registration {COMPANY.crNumber} · E-commerce licence{" "}
        {COMPANY.licenceNumber} · VAT {COMPANY.vatNumber} · {COMPANY.address}
        {COMPANY.isPlaceholder && <b> (Bracketed details are placeholders — the client must supply them.)</b>}
      </address>
      <div className="footer-fine">
        <span>© 2026 {COMPANY.tradingName}. Prices in Omani rials, VAT included.</span>
        <span>3D previews are rendered live in your browser.</span>
      </div>
    </footer>
  );
}
