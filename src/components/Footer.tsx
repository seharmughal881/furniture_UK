import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog-data";
import { getCompany } from "@/lib/content/company";
import { getContent } from "@/lib/content/read";
import { Newsletter } from "./Newsletter";

type FooterCopy = {
  bigLine: string;
  bigLineEmphasis: string;
  showrooms: { name: string }[];
  help: { label: string; href: string }[];
  finePrint: string;
  finePrintRight: string;
};

export async function Footer() {
  const [copy, COMPANY] = await Promise.all([getContent<FooterCopy>("footer"), getCompany()]);
  return (
    <footer className="footer" id="visit">
      <div className="footer-top">
        <div className="footer-big">
          {copy.bigLine}
          <br />
          <em>{copy.bigLineEmphasis}</em>
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
          {copy.showrooms.map((c) => (
            <Link key={c.name} href="/stores">
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <p className="label">Help</p>
          {copy.help.map((h) => (
            <Link key={h.href + h.label} href={h.href}>
              {h.label}
            </Link>
          ))}
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
        <span>{copy.finePrint}</span>
        <span>{copy.finePrintRight}</span>
      </div>
    </footer>
  );
}
