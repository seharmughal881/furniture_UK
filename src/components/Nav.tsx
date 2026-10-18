"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, ROOMS } from "@/lib/catalog-data";
import { formatPrice, type Product } from "@/lib/types";
import { useCart } from "./commerce/CartProvider";

export function Nav({ products }: { products: Product[] }) {
  const { cart, setOpen } = useCart();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [search, setSearch] = useState(false);
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
      <div className="announce">
        <span>
          Free delivery over £1,000 to every UK address<span className="more"> · 100-night home trial · Lifetime frame guarantee</span>
        </span>
      </div>
      <header className="nav" onMouseLeave={() => setMega(false)}>
        <button className="icon-btn nav-burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <span />
          <span />
        </button>
        <Link href="/" className="nav-logo" aria-label="Atelier home">
          Atelier<span>®</span>
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
          <Link href="/planner" className="nav-link">
            Room planner
          </Link>
          <Link href="/help" className="nav-link">
            Delivery &amp; returns
          </Link>
          <Link href="/#visit" className="nav-link">
            Studio
          </Link>
        </nav>
        <div className="nav-actions">
          <button className="icon-btn" aria-label="Search" onClick={() => setSearch(true)}>
            <SearchIcon />
          </button>
          <button className="cart-btn" onClick={() => setOpen(true)} aria-label={`Basket, ${cart.count} items`}>
            Basket <span className={cart.count ? "has" : ""}>{cart.count}</span>
          </button>
        </div>

        <div
          id="mega"
          className={`mega ${mega ? "open" : ""}`}
          onMouseEnter={() => setMega(true)}
          onClick={closeOnLink(() => setMega(false))}
        >
          <div className="mega-cols">
            {ROOMS.map((r) => {
              const inRoom = products.filter((p) => p.rooms[0] === r.slug);
              return (
                <div key={r.slug}>
                  <Link href={`/shop?room=${r.slug}`} className="label mega-title">
                    {r.name}
                  </Link>
                  {inRoom.slice(0, 7).map((p) => (
                    <Link key={p.slug} href={`/product/${p.slug}`} className="mega-item">
                      {p.name}
                      <small>{formatPrice(p.priceCents)}</small>
                    </Link>
                  ))}
                  <Link href={`/shop?room=${r.slug}`} className="mega-more">
                    All {r.name.toLowerCase()} →
                  </Link>
                </div>
              );
            })}
            <Link href="/planner" className="mega-feature">
              <span className="label">New</span>
              <strong>Plan your whole room in 3D</strong>
              <span>Arrange pieces, see it at night, add the whole room to your basket →</span>
            </Link>
          </div>
          <div className="mega-types">
            <span className="label" style={{ margin: 0 }}>
              By type
            </span>
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/shop?category=${c.slug}`} className="chip">
                {c.name}
              </Link>
            ))}
            <Link href="/shop" className="mega-all">
              Shop all {products.length} pieces →
            </Link>
          </div>
        </div>
      </header>

      <div onClick={closeOnLink(() => setMenu(false))}>
        <MobileMenu open={menu} onClose={() => setMenu(false)} />
      </div>
      {search && <SearchOverlay products={products} onClose={() => setSearch(false)} />}
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`mobile-menu ${open ? "open" : ""}`} aria-hidden={!open} data-lenis-prevent>
      <div className="mobile-head">
        <span className="nav-logo">Atelier</span>
        <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
          ✕
        </button>
      </div>
      <nav aria-label="Mobile">
        <Link href="/shop">Shop all</Link>
        {ROOMS.map((r) => (
          <Link key={r.slug} href={`/shop?room=${r.slug}`} className="sub">
            {r.name}
          </Link>
        ))}
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/shop?category=${c.slug}`} className="sub">
            {c.name}
          </Link>
        ))}
        <Link href="/planner">Room planner</Link>
        <Link href="/help">Delivery &amp; returns</Link>
        <Link href="/#visit">Visit the studio</Link>
      </nav>
    </div>
  );
}

function SearchOverlay({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) =>
      [p.name, p.tagline, p.category, p.kind, ...p.details].some((s) => s.toLowerCase().includes(t)),
    );
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
            placeholder="Search sofas, oak, lamps…"
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.slug}>
              <Link href={`/product/${p.slug}`} onClick={onClose}>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.tagline}</small>
                </span>
                <span className="price">{formatPrice(p.priceCents)}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="hint">No pieces match “{q}”.</li>}
        </ul>
      </div>
    </div>
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
