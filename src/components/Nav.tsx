"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/catalog-data";
import { COMPANY, whatsappLink } from "@/lib/company";
import { formatPrice, type ProductSummary } from "@/lib/types";
import { useCart } from "./commerce/CartProvider";
import { WishlistCount } from "./commerce/WishlistView";
import { shopifyImage } from "@/lib/images";

const catName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

/**
 * The editable parts of the header. Passed in rather than read here because this is a
 * client component (it owns the menu, search and basket state) and getContent() is
 * server-only -- the storefront layout reads it and hands it down.
 */
export type NavCopy = {
  announcement: { enabled: boolean; message: string; extra: string; messageAr: string };
  links: { label: string; href: string }[];
  departments: { title: string; categories: string }[];
};

/** One row of the header search's results; served by /api/search-index. */
type SearchItem = Pick<ProductSummary, "slug" | "name" | "nameAr" | "category" | "priceCents" | "image">;

// Fetched once per visit, the first time search is opened or its icon is reached; a failed
// request is forgotten so the next attempt tries again.
let searchIndex: Promise<SearchItem[]> | null = null;
function loadSearchIndex() {
  searchIndex ??= fetch("/api/search-index")
    .then((r) => {
      if (!r.ok) throw new Error(`search index ${r.status}`);
      return r.json() as Promise<SearchItem[]>;
    })
    .catch((e) => {
      searchIndex = null;
      throw e;
    });
  return searchIndex;
}

/**
 * `counts` (products per category) and `total` are all the header needs up front; the
 * catalogue itself is no longer sent with every page -- see /api/search-index.
 */
export function Nav({ counts: countsByCategory, total, copy }: { counts: Record<string, number>; total: number; copy: NavCopy }) {
  // "sofas, tables, decor" as typed in the back office -> the category slugs to list.
  const departments = copy.departments.map((d) => ({
    title: d.title,
    categories: d.categories
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  }));
  const { cart, setOpen } = useCart();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [search, setSearch] = useState(false);
  const counts = useMemo(() => new Map(Object.entries(countsByCategory)), [countsByCategory]);

  // close a menu once one of its links is followed
  const closeOnLink = (close: () => void) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) close();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMenu(false);
        setMega(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = menu || search ? "hidden" : "";
  }, [menu, search]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {copy.announcement.enabled && (
        <div className="announce">
          <span>
            {copy.announcement.message}
            {copy.announcement.extra && <span className="more">{copy.announcement.extra}</span>}
          </span>
        </div>
      )}
      <header className="nav" onMouseLeave={() => setMega(false)}>
        <button className="icon-btn nav-burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <span />
          <span />
        </button>
        <Link href="/" className="nav-logo" aria-label={`${COMPANY.tradingName} home`}>
          <LogoMark />
          Muscat <span className="logo-sub">Furniture</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <button
            className={`nav-link ${mega ? "on" : ""}`}
            aria-expanded={mega}
            aria-controls="mega"
            onMouseEnter={() => setMega(true)}
            onClick={() => setMega((v) => !v)}
          >
            Shop
          </button>
          {copy.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            className="icon-btn"
            aria-label="Search"
            onClick={() => setSearch(true)}
            // start fetching the list as the pointer arrives, so results are there on open
            onPointerEnter={() => void loadSearchIndex().catch(() => {})}
            onFocus={() => void loadSearchIndex().catch(() => {})}
          >
            <SearchIcon />
          </button>
          <WishlistCount />
          <button className="cart-btn" onClick={() => setOpen(true)} aria-label={`Basket, ${cart.count} items`}>
            <svg className="cart-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
            <em className="cart-label">Basket</em> <span className={cart.count ? "has" : ""}>{cart.count}</span>
          </button>
        </div>

        <div
          id="mega"
          className={`mega ${mega ? "open" : ""}`}
          onMouseEnter={() => setMega(true)}
          onClick={closeOnLink(() => setMega(false))}
        >
          <div className="mega-cols">
            {departments.map((d) => (
              <div key={d.title}>
                <p className="label mega-title">{d.title}</p>
                {d.categories.map((c) => (
                  <Link key={c} href={`/shop?category=${c}`} className="mega-item">
                    {catName(c)}
                    <small>{counts.get(c) ?? 0}</small>
                  </Link>
                ))}
              </div>
            ))}
            <Link href="/planner" className="mega-feature">
              <span className="label">New</span>
              <strong>Plan your room in 3D</strong>
              <span>Arrange our sofas, beds and dining sets, see them at night, add the whole room to your basket →</span>
            </Link>
          </div>
          <div className="mega-types">
            <Link href="/shop?sort=saving" className="chip">
              Biggest savings
            </Link>
            <Link href="/shop?view=3d" className="chip">
              View in 3D
            </Link>
            <Link href="/shop" className="mega-all">
              Shop all {total} products →
            </Link>
          </div>
        </div>
      </header>

      <div onClick={closeOnLink(() => setMenu(false))}>
        <MobileMenu open={menu} onClose={() => setMenu(false)} />
      </div>
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      <a
        className="wa-float"
        href={whatsappLink("Hello Muscat Furniture, I have a question.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <WhatsAppIcon />
      </a>
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`mobile-menu ${open ? "open" : ""}`} aria-hidden={!open} data-lenis-prevent>
      <div className="mobile-head">
        <span className="nav-logo">Muscat Furniture</span>
        <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
          ✕
        </button>
      </div>
      <nav aria-label="Mobile">
        <Link href="/shop">Shop all</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/shop?category=${c.slug}`} className="sub">
            {c.name}
          </Link>
        ))}
        <Link href="/planner">Room planner</Link>
        <Link href="/stores">Showrooms</Link>
        <Link href="/wishlist">Wishlist ♥</Link>
        <Link href="/help">Delivery &amp; returns</Link>
      </nav>
    </div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    let live = true;
    loadSearchIndex()
      .then((list) => live && setProducts(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  const results = useMemo(() => {
    if (!products) return [];
    const t = q.trim().toLowerCase();
    if (!t) return products.slice(0, 12);
    return products
      .filter((p) => [p.name, p.nameAr, p.category, catName(p.category)].some((s) => s.toLowerCase().includes(t)))
      .slice(0, 30);
  }, [q, products]);

  return (
    <div className="search-root" role="dialog" aria-modal="true" aria-label="Search products">
      <div className="drawer-scrim" onClick={onClose} />
      <div className="search-panel" data-lenis-prevent>
        <div className="search-input">
          <SearchIcon />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sofa sets, wardrobes, chandeliers… / ابحث"
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.slug}>
              <Link href={`/product/${p.slug}`} onClick={onClose}>
                {p.image && <img src={shopifyImage(p.image, 120)} alt="" width={48} height={48} loading="lazy" />}
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {catName(p.category)}
                    {p.nameAr && <bdi dir="rtl"> · {p.nameAr}</bdi>}
                  </small>
                </span>
                <span className="price">{formatPrice(p.priceCents)}</span>
              </Link>
            </li>
          ))}
          {!products && !failed && <li className="hint">Loading products…</li>}
          {failed && <li className="hint">Search could not load. Check your connection and try again.</li>}
          {products && results.length === 0 && <li className="hint">No products match “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

/** Brand mark: a red two-seat sofa on a black base, after the Muscat Furniture logo. */
function LogoMark() {
  return (
    <svg className="logo-mark" width="34" height="26" viewBox="0 0 34 26" aria-hidden>
      {/* colours come from CSS (.logo-mark): gold on the dark header */}
      <rect className="cushion" x="6" y="2" width="10.5" height="12" rx="4" />
      <rect className="cushion" x="17.5" y="2" width="10.5" height="12" rx="4" />
      <path className="frame" d="M2 10.5c0-1.7 3-1.7 3 0v6h24v-6c0-1.7 3-1.7 3 0V19c0 1.2-.8 2-2 2H4c-1.2 0-2-.8-2-2Z" />
      <path className="legs" d="M5 23.5h3M26 23.5h3" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.07.9.92-2.99-.2-.31a8.2 8.2 0 1 1 6.83 3.73Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.31c-.22.25-.86.84-.86 2.04s.88 2.37 1 2.53c.12.16 1.73 2.64 4.2 3.7.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.14-1.17-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}
