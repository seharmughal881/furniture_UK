import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { HoursTable, OpenStatus } from "@/components/stores/OpenStatus";
import { ShowroomMedia } from "@/components/stores/ShowroomMedia";
import type { ReelClip } from "@/components/stores/ShowroomReel";
import { videosFor } from "@/lib/category-videos";
import { getProductIndex, getStores } from "@/lib/catalog";
import { directionsUrl, mapEmbedUrl, showroomFor, streetViewUrl } from "@/lib/showrooms";

export async function generateStaticParams() {
  // Every showroom is prerendered; with Cache Components this must not be empty.
  const stores = await getStores();
  return stores.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: PageProps<"/stores/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const store = (await getStores()).find((s) => s.slug === slug);
  if (!store) return {};
  return {
    title: store.name,
    description: `Visit Muscat Furniture ${store.name.toLowerCase()}: ${store.address}. Opening hours, directions, phone and WhatsApp.`,
    alternates: { canonical: `/stores/${store.slug}` },
  };
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

export default async function ShowroomPage(props: PageProps<"/stores/[slug]">) {
  const { slug } = await props.params;
  const [stores, index] = await Promise.all([getStores(), getProductIndex()]);
  const at = stores.findIndex((s) => s.slug === slug);
  const store = stores[at];
  if (!store) notFound();

  const extra = showroomFor(store);
  const isOffice = store.kind === "office";

  // The showroom's own footage when there is one. Until then, our furniture videos, rotated
  // per showroom so each page opens on a different clip, and labelled for what they are.
  const pool = videosFor(index, { max: 12 });
  const rotated = [...pool.slice(at % Math.max(pool.length, 1)), ...pool.slice(0, at % Math.max(pool.length, 1))];
  const clips: ReelClip[] = extra.video
    ? [{ src: extra.video, poster: rotated[0]?.poster ?? "", title: `Inside ${store.name}` }]
    : rotated.slice(0, 4).map((v) => ({ src: v.sd, poster: v.poster, title: v.name }));
  const reelLabel = extra.video ? "Inside the showroom" : "On display · from our collection";
  // Directions go to the shop's exact Google pin where we have it, not a text search.
  const destination = extra.streetView ? extra.streetView.pin.join(",") : extra.mapQuery;

  const [place, kindWord] = isOffice ? ["Head", "office"] : [store.name.replace(/ showroom$/i, ""), "showroom"];
  const others = stores.filter((s) => s.slug !== store.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isOffice ? "Organization" : "FurnitureStore",
    name: `Muscat Furniture — ${store.name}`,
    address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: store.city, addressCountry: "OM" },
    telephone: store.phone || undefined,
    email: store.email || undefined,
    url: `/stores/${store.slug}`,
  };

  return (
    <main className="showroom">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="section showroom-hero">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/stores">Showrooms</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{store.city}</span>
        </nav>

        <div className="showroom-top">
          <ShowroomMedia
            streetViewSrc={extra.streetView ? streetViewUrl(extra.streetView) : null}
            inside={Boolean(extra.streetView?.inside)}
            place={store.name}
            clips={clips}
            reelLabel={reelLabel}
          />

          <div className="showroom-intro">
            <p className="label">{isOffice ? "Head office · " + store.city : store.city + " · Oman"}</p>
            <h1>
              {place} <em>{kindWord}.</em>
            </h1>
            <p className="showroom-address">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2.4" />
              </svg>
              {store.address}
            </p>
            {extra.week && <OpenStatus week={extra.week} />}
            <p className="showroom-lede">
              {isOffice
                ? "Our head office runs orders, delivery and after-sales for every governorate. For seeing furniture in person, visit one of our showrooms."
                : "Sit on the sofa sets, open the wardrobes and feel the fabrics before you buy. Our team here can take your order and arrange delivery to your door."}
            </p>
            <div className="showroom-cta">
              <a className="btn solid" href={directionsUrl(destination)} target="_blank" rel="noopener noreferrer">
                Get directions →
              </a>
              {store.phone && (
                <a className="btn" href={`tel:+${digits(store.phone)}`}>
                  Call {store.phone}
                </a>
              )}
              {store.whatsapp && (
                <a
                  className="btn wa-btn"
                  href={`https://wa.me/${digits(store.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section showroom-find" aria-labelledby="find-title">
        <div className="showroom-map">
          <iframe
            title={`Map showing ${store.name}`}
            src={mapEmbedUrl(extra.mapQuery)}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <aside className="showroom-info">
          <h2 id="find-title">
            Find <em>us.</em>
          </h2>
          <dl>
            <div>
              <dt>Address</dt>
              <dd>{store.address}</dd>
            </div>
            {store.phone && (
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:+${digits(store.phone)}`}>{store.phone}</a>
                </dd>
              </div>
            )}
            {store.whatsapp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  <a href={`https://wa.me/${digits(store.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                    {store.whatsapp}
                  </a>
                </dd>
              </div>
            )}
            {store.email && (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${store.email}`}>{store.email}</a>
                </dd>
              </div>
            )}
          </dl>
          {extra.week ? (
            <>
              <h3>Opening hours</h3>
              <HoursTable week={extra.week} />
            </>
          ) : (
            <p className="hint">Office — no walk-in showroom hours. Call or WhatsApp us.</p>
          )}
          <a className="showroom-open-maps" href={directionsUrl(destination)} target="_blank" rel="noopener noreferrer">
            Open in Google Maps ↗
          </a>
        </aside>
      </section>

      <section className="section showroom-others" aria-labelledby="others-title">
        <h2 id="others-title">
          Other <em>showrooms.</em>
        </h2>
        <ul>
          {others.map((s) => (
            <li key={s.slug}>
              <Link href={`/stores/${s.slug}`}>
                <span className="label">{s.kind === "office" ? "Head office" : s.city}</span>
                <strong>{s.name}</strong>
                <span className="arrow" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </main>
  );
}
