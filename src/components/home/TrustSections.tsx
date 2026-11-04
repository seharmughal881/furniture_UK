import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog-data";
import { videosFor } from "@/lib/category-videos";
import { getContent } from "@/lib/content/read";
import { shopifyImage } from "@/lib/images";
import type { ProductSummary } from "@/lib/types";
import { CategoryCarousel } from "./CategoryCarousel";

// Line icons; their strokes "draw in" when the section is revealed (see .trust .draw in CSS).
const ICONS: Record<string, React.ReactNode> = {
  cash: (
    <>
      <rect className="draw" x="3" y="6" width="18" height="12" rx="2" />
      <circle className="draw" cx="12" cy="12" r="2.6" />
      <path className="draw" d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  truck: (
    <>
      <path className="draw" d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
      <circle className="draw" cx="6.5" cy="17" r="1.8" />
      <circle className="draw" cx="17" cy="17" r="1.8" />
    </>
  ),
  returns: (
    <>
      <path className="draw" d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path className="draw" d="M4 4.5v4.2h4.2" />
    </>
  ),
  store: (
    <>
      <path className="draw" d="M3.5 9.5 5 4.5h14l1.5 5" />
      <path className="draw" d="M4.5 9.5v10h15v-10M9.5 19.5v-5h5v5" />
    </>
  ),
  cube: (
    <>
      <path className="draw" d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path className="draw" d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  chat: (
    <>
      <path className="draw" d="M4 18.5 5.3 15A7.5 7.5 0 1 1 9 18.3Z" />
      <path className="draw" d="M9 10.5h6M9 13.5h4" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="trust-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/** The promises that make people comfortable buying furniture online. Editable in the back office. */
export async function TrustStrip() {
  const { items } = await getContent<{
    items: { icon: keyof typeof ICONS; title: string; text: string; href: string }[];
  }>("trust");
  return (
    <section className="trust" aria-label="Why shop with us">
      {items.map((it) => (
        <Link key={it.title} href={it.href} className="trust-item">
          <Icon name={it.icon} />
          <strong>{it.title}</strong>
          <span>{it.text}</span>
        </Link>
      ))}
    </section>
  );
}

/** Horizontal, draggable rail of categories using a real product photo for each. */
export async function CategoryRail({ products }: { products: ProductSummary[] }) {
  const copy = await getContent<{ heading: string; emphasis: string; body: string }>("category_rail");
  const cats = CATEGORIES.map((c) => {
    const inCat = products.filter((p) => p.category === c.slug && p.image);
    return { ...c, count: inCat.length, image: inCat[0]?.image ?? null };
  }).filter((c) => c.count > 0);
  // one video per card, a different clip for each where possible (several categories borrow related videos)
  const used = new Set<string>();
  const video = (slug: string) => {
    const list = videosFor(products, { category: slug });
    const v = list.find((x) => !used.has(x.slug)) ?? list[0];
    if (v) used.add(v.slug);
    return v ? v.sd : null;
  };
  return (
    <section className="section cat-section" aria-labelledby="cat-title">
      <div className="section-head">
        <h2 id="cat-title">
          {copy.heading} <em>{copy.emphasis}</em>
        </h2>
        <p>{copy.body}</p>
      </div>
      <CategoryCarousel
        tiles={cats.map((c) => ({
          slug: c.slug,
          name: c.name,
          nameAr: c.nameAr,
          count: c.count,
          image: c.image && shopifyImage(c.image, 600),
          video: video(c.slug),
        }))}
      />
    </section>
  );
}

/** Ordering in a few plain steps. Editable in the back office. */
export async function HowToOrder() {
  const copy = await getContent<{
    heading: string;
    emphasis: string;
    body: string;
    steps: { icon: keyof typeof ICONS; title: string; text: string }[];
  }>("how_to_order");
  const steps = copy.steps;
  return (
    <section className="section how" aria-labelledby="how-title">
      <div className="section-head">
        <h2 id="how-title">
          {copy.heading} <em>{copy.emphasis}</em>
        </h2>
        <p>{copy.body}</p>
      </div>
      <ol className="how-steps">
        {steps.map((s, i) => (
          <li key={s.title} className="how-step">
            <span className="how-num">{i + 1}</span>
            <Icon name={s.icon} />
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * "We're near you": the showroom network with delivery lines from the head office.
 *
 * A schematic network like a metro map, not to scale -- positions are percentages across
 * the panel, chosen so every label stays readable. All of it is editable in the back
 * office; the first place in the list is the head office the lines radiate from.
 */
export async function ShowroomMap() {
  const copy = await getContent<{
    label: string;
    heading: string;
    emphasis: string;
    body: string;
    buttonLabel: string;
    cities: { name: string; x: number; y: number; side: "r" | "l" | "b" | "t"; office: boolean }[];
  }>("showroom_map");
  const CITIES = copy.cities;
  const hq = CITIES[0];
  if (!hq) return null;
  return (
    <section className="section map-section" aria-labelledby="map-title">
      <div className="map-copy">
        <p className="label">{copy.label}</p>
        <h2 id="map-title">
          {copy.heading} <em>{copy.emphasis}</em>
        </h2>
        <p>{copy.body}</p>
        <Link href="/stores" className="btn">
          {copy.buttonLabel}
        </Link>
      </div>
      <div className="map-panel" role="img" aria-label="Diagram of Muscat Furniture showrooms across Oman">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="map-lines" aria-hidden>
          {CITIES.slice(1).map((c) => (
            <line key={c.name} x1={hq.x} y1={hq.y} x2={c.x} y2={c.y} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {CITIES.map((c, i) => (
          <span
            key={c.name}
            className={`map-pin side-${c.side} ${c.office ? "hq" : ""}`}
            style={{ left: `${c.x}%`, top: `${c.y}%`, "--i": i } as React.CSSProperties}
          >
            <i />
            <b>{c.name}</b>
          </span>
        ))}
        <small className="map-note">Diagram, not to scale</small>
      </div>
    </section>
  );
}
