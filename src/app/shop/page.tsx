import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { ShopGrid } from "@/components/shop/ShopGrid";
import { getMaterials, getProducts } from "@/lib/catalog";
import { CATEGORIES, ROOMS } from "@/lib/catalog-data";

export const metadata: Metadata = {
  title: "Shop all furniture",
  description: "Handmade sofas, chairs, tables, lighting and storage — each one rendered live in 3D.",
};

const SORTS = [
  { slug: "featured", name: "Featured" },
  { slug: "price-asc", name: "Price: low to high" },
  { slug: "price-desc", name: "Price: high to low" },
  { slug: "rating", name: "Top rated" },
] as const;

const PRICES = [
  { slug: "under-500", name: "Under £500", max: 50000 },
  { slug: "500-1500", name: "£500 – £1,500", min: 50000, max: 150000 },
  { slug: "over-1500", name: "Over £1,500", min: 150000 },
] as const;

type Params = { room?: string; category?: string; sort?: string; price?: string };

const href = (current: Params, patch: Params) => {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/shop?${qs}` : "/shop";
};

async function Results({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params: Params = { room: one(raw.room), category: one(raw.category), sort: one(raw.sort), price: one(raw.price) };
  const [all, materials] = await Promise.all([getProducts(), getMaterials()]);

  const price = PRICES.find((p) => p.slug === params.price);
  let list = all.filter(
    (p) =>
      (!params.room || p.rooms.includes(params.room)) &&
      (!params.category || p.category === params.category) &&
      (!price || ((!("min" in price) || p.priceCents >= price.min) && (!("max" in price) || p.priceCents < price.max))),
  );
  if (params.sort === "price-asc") list = [...list].sort((a, b) => a.priceCents - b.priceCents);
  if (params.sort === "price-desc") list = [...list].sort((a, b) => b.priceCents - a.priceCents);
  if (params.sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const category = CATEGORIES.find((c) => c.slug === params.category);
  const room = ROOMS.find((r) => r.slug === params.room);
  const title = [room?.name, category?.name].filter(Boolean).join(" · ") || "All furniture";

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link>
        {room && <> / <Link href={href({}, { room: room.slug })}>{room.name}</Link></>}
        {category && <> / <span>{category.name}</span></>}
      </nav>
      <div className="shop-head">
        <h1>{title}</h1>
        <p>
          {list.length} {list.length === 1 ? "piece" : "pieces"} · made to order by one maker
          {room && (
            <>
              {" · "}
              <Link href={`/planner?preset=${room.slug}`} className="inline-link">
                Plan a {room.name.toLowerCase()} in 3D →
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="filters" role="navigation" aria-label="Filters">
        <div className="chips">
          <span className="label" style={{ margin: 0 }}>
            Room
          </span>
          <Link href={href(params, { room: undefined })} className={`chip ${!params.room ? "on" : ""}`}>
            All rooms
          </Link>
          {ROOMS.map((r) => (
            <Link
              key={r.slug}
              href={href(params, { room: r.slug })}
              className={`chip ${params.room === r.slug ? "on" : ""}`}
              aria-current={params.room === r.slug ? "page" : undefined}
            >
              {r.name}
            </Link>
          ))}
        </div>
        <div className="chips">
          <span className="label" style={{ margin: 0 }}>
            Type
          </span>
          <Link href={href(params, { category: undefined })} className={`chip ${!params.category ? "on" : ""}`}>
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={href(params, { category: c.slug })}
              className={`chip ${params.category === c.slug ? "on" : ""}`}
              aria-current={params.category === c.slug ? "page" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="chips">
          {PRICES.map((p) => (
            <Link
              key={p.slug}
              href={href(params, { price: params.price === p.slug ? undefined : p.slug })}
              className={`chip ${params.price === p.slug ? "on" : ""}`}
            >
              {p.name}
            </Link>
          ))}
        </div>
        <div className="chips sort">
          <span className="label" style={{ margin: 0 }}>
            Sort
          </span>
          {SORTS.map((s) => (
            <Link
              key={s.slug}
              href={href(params, { sort: s.slug === "featured" ? undefined : s.slug })}
              className={`chip ${(params.sort ?? "featured") === s.slug ? "on" : ""}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      {list.length ? (
        <ShopGrid products={list} all={all} materials={materials} />
      ) : (
        <div className="empty">
          <p>No pieces match these filters.</p>
          <Link href="/shop" className="btn">
            Clear filters
          </Link>
        </div>
      )}
    </>
  );
}

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <main>
      <section className="section shop">
        <Suspense fallback={<div className="shop-skeleton" aria-busy="true" />}>
          <Results searchParams={props.searchParams} />
        </Suspense>
      </section>
      <Footer />
    </main>
  );
}
