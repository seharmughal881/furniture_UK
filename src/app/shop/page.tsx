import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/shop/ProductCard";
import { CategoryReel } from "@/components/shop/CategoryReel";
import { ShopSpotlight } from "@/components/shop/ShopSpotlight";
import { getProductIndex } from "@/lib/catalog";
import { CATEGORIES, ROOMS } from "@/lib/catalog-data";
import { videosFor } from "@/lib/category-videos";
import { shopifyImage } from "@/lib/images";
import { savingPercent } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop furniture, lighting & more",
  description: "Sofa sets, bedroom sets, dining, mattresses, lighting, switches and sanitary — delivered across Oman.",
};

const PAGE_SIZE = 24;

const SORTS = [
  { slug: "featured", name: "Featured" },
  { slug: "saving", name: "Biggest saving" },
  { slug: "price-asc", name: "Price: low to high" },
  { slug: "price-desc", name: "Price: high to low" },
] as const;

// prices in baisa (1 OMR = 1000)
const PRICES = [
  { slug: "under-50", name: "Under OMR 50", max: 50_000 },
  { slug: "50-200", name: "OMR 50 – 200", min: 50_000, max: 200_000 },
  { slug: "200-500", name: "OMR 200 – 500", min: 200_000, max: 500_000 },
  { slug: "over-500", name: "Over OMR 500", min: 500_000 },
] as const;

type Params = { room?: string; category?: string; sort?: string; price?: string; view?: string; page?: string };

const href = (current: Params, patch: Params) => {
  // any filter change goes back to page 1
  const next = { ...current, page: undefined, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/shop?${qs}` : "/shop";
};

async function Results({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params: Params = {
    room: one(raw.room),
    category: one(raw.category),
    sort: one(raw.sort),
    price: one(raw.price),
    view: one(raw.view),
    page: one(raw.page),
  };
  const all = await getProductIndex();

  const price = PRICES.find((p) => p.slug === params.price);
  let list = all.filter(
    (p) =>
      (!params.room || p.rooms.includes(params.room)) &&
      (!params.category || p.category === params.category) &&
      (params.view !== "3d" || p.kind) &&
      (!price || ((!("min" in price) || p.priceCents >= price.min) && (!("max" in price) || p.priceCents < price.max))),
  );
  if (params.sort === "price-asc") list = [...list].sort((a, b) => a.priceCents - b.priceCents);
  if (params.sort === "price-desc") list = [...list].sort((a, b) => b.priceCents - a.priceCents);
  if (params.sort === "saving")
    list = [...list].sort(
      (a, b) => savingPercent(b.priceCents, b.compareAtCents) - savingPercent(a.priceCents, a.compareAtCents),
    );

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const category = CATEGORIES.find((c) => c.slug === params.category);
  const room = ROOMS.find((r) => r.slug === params.room);
  const title = [room?.name, category?.name].filter(Boolean).join(" · ") || "All products";
  const plannable = room && ["living", "bedroom", "dining"].includes(room.slug);
  const videos = videosFor(all, { category: params.category, room: params.room });
  // one real product photo per type card (white-background cut-outs read best at this size)
  const thumbs = Object.fromEntries(
    CATEGORIES.map((c) => [c.slug, all.find((p) => p.category === c.slug && p.image)?.image ?? null]),
  );

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link>
        {room && <> / <Link href={href({}, { room: room.slug })}>{room.name}</Link></>}
        {category && <> / <span>{category.name}</span></>}
      </nav>
      <div className={`shop-head with-spotlight ${videos.length ? "with-reel" : ""}`}>
        {videos.length ? (
          // key: a new category starts from its own first video
          <CategoryReel key={`${params.category}-${params.room}`} videos={videos} />
        ) : (
          <ShopSpotlight category={params.category} room={params.room} />
        )}
        <h1>
          {title}
          {category && (
            <span className="title-ar" dir="rtl" lang="ar">
              {category.nameAr}
            </span>
          )}
        </h1>
        <p>
          {list.length} {list.length === 1 ? "product" : "products"} · delivered across Oman
          {plannable && (
            <>
              {" · "}
              <Link href={`/planner?preset=${room.slug}`} className="inline-link">
                Plan your {room.name.toLowerCase()} in 3D →
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="filters" role="navigation" aria-label="Filters">
        {/* product type: cards with a real product photo, scrolling sideways */}
        <div className="type-rail" aria-label="Type">
          <Link href={href(params, { category: undefined })} className={`type-card ${!params.category ? "on" : ""}`}>
            <span className="type-thumb all" aria-hidden>
              ✦
            </span>
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={href(params, { category: c.slug })}
              className={`type-card ${params.category === c.slug ? "on" : ""}`}
              aria-current={params.category === c.slug ? "page" : undefined}
            >
              <span className="type-thumb" aria-hidden>
                {thumbs[c.slug] && <img src={shopifyImage(thumbs[c.slug]!, 120)} alt="" loading="lazy" decoding="async" />}
              </span>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="filter-bar">
          <div className="segmented" aria-label="Room">
            <Link href={href(params, { room: undefined })} className={!params.room ? "on" : ""}>
              All rooms
            </Link>
            {ROOMS.map((r) => (
              <Link key={r.slug} href={href(params, { room: r.slug })} className={params.room === r.slug ? "on" : ""}>
                {r.name.replace(" room", "")}
              </Link>
            ))}
          </div>
          <Link
            href={href(params, { view: params.view === "3d" ? undefined : "3d" })}
            className={`toggle-3d ${params.view === "3d" ? "on" : ""}`}
            aria-pressed={params.view === "3d"}
          >
            <i aria-hidden /> 3D preview
          </Link>

          <div className="filter-menus">
            <span className="result-count">{list.length} products</span>
            {/* key: the menu closes after choosing (a new value remounts it) */}
            <details className="menu" key={`price-${params.price}`}>
              <summary>
                <small>Price</small> {price?.name ?? "Any"}
              </summary>
              <div className="menu-list">
                <Link href={href(params, { price: undefined })} className={!price ? "on" : ""}>
                  Any price
                </Link>
                {PRICES.map((p) => (
                  <Link key={p.slug} href={href(params, { price: p.slug })} className={params.price === p.slug ? "on" : ""}>
                    {p.name}
                  </Link>
                ))}
              </div>
            </details>
            <details className="menu" key={`sort-${params.sort}`}>
              <summary>
                <small>Sort</small> {(SORTS.find((x) => x.slug === params.sort) ?? SORTS[0]).name}
              </summary>
              <div className="menu-list right">
                {SORTS.map((x) => (
                  <Link
                    key={x.slug}
                    href={href(params, { sort: x.slug === "featured" ? undefined : x.slug })}
                    className={(params.sort ?? "featured") === x.slug ? "on" : ""}
                  >
                    {x.name}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>

      {shown.length ? (
        <>
          <ProductGrid products={shown} />
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              {page > 1 && (
                <Link href={href(params, { page: String(page - 1) })} className="chip">
                  ← Previous
                </Link>
              )}
              <span>
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link href={href(params, { page: String(page + 1) })} className="chip">
                  Next →
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="empty">
          <p>No products match these filters.</p>
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
