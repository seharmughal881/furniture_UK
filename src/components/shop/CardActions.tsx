"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/components/commerce/CartProvider";
import { HeartButton } from "@/components/commerce/Wishlist";
import { whatsappLink } from "@/lib/company";
import { shopifyImage } from "@/lib/images";
import { DELIVERY, formatPrice, savingPercent, type ProductSummary } from "@/lib/types";

/** Wishlist, quick view and quick add, shown over a product card. */
export function CardActions({ product }: { product: ProductSummary }) {
  const { add, busy } = useCart();
  const [open, setOpen] = useState(false);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <HeartButton slug={product.slug} name={product.name} className="card-heart" />
      <div className="card-actions">
        <button
          type="button"
          className="card-act"
          onClick={(e) => {
            stop(e);
            setOpen(true);
          }}
        >
          Quick view
        </button>
        {product.inStock && !product.hasOptions && (
          <button
            type="button"
            className="card-act solid"
            disabled={busy}
            aria-label={`Add ${product.name} to basket`}
            onClick={(e) => {
              stop(e);
              const img = (e.currentTarget.closest(".photo-card")?.querySelector(".card-photo img") as HTMLImageElement | null)?.currentSrc;
              add(
                [{ productSlug: product.slug, quantity: 1, variant: "", config: { fabric: "", wood: "", metal: "" } }],
                { from: e.currentTarget, image: img ?? null },
              );
            }}
          >
            + Add
          </button>
        )}
      </div>
      {open && <QuickView product={product} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickView({ product, onClose }: { product: ProductSummary; onClose: () => void }) {
  const { add, busy } = useCart();
  const [img, setImg] = useState(product.image);
  const save = savingPercent(product.priceCents, product.compareAtCents);
  const images = [product.image, product.image2].filter(Boolean) as string[];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="qv-root" role="dialog" aria-modal="true" aria-label={product.name} data-lenis-prevent>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="qv-panel">
        <button className="icon-btn qv-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="qv-media">
          {img && <img src={shopifyImage(img, 800)} alt={product.name} />}
          {images.length > 1 && (
            <div className="qv-thumbs">
              {images.map((s) => (
                <button key={s} aria-pressed={s === img} onClick={() => setImg(s)}>
                  <img src={shopifyImage(s, 400)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="qv-info">
          <h2>{product.name}</h2>
          {product.nameAr && (
            <p className="name-ar big" dir="rtl" lang="ar">
              {product.nameAr}
            </p>
          )}
          <div className="price-row">
            <strong>{formatPrice(product.priceCents)}</strong>
            {save > 0 && product.compareAtCents && (
              <>
                <s>{formatPrice(product.compareAtCents)}</s>
                <span className="badge sale">Save {save}%</span>
              </>
            )}
          </div>
          <p className={`stock ${product.inStock ? "in" : "out"}`}>{product.inStock ? "● In stock" : "● Sold out"}</p>
          <ul className="perks">
            <li>
              <b>Cash on delivery</b> · delivered in {DELIVERY.days} across Oman
            </li>
            <li>
              <b>Free delivery</b> over {formatPrice(DELIVERY.freeOverCents)}
            </li>
          </ul>
          {product.inStock && !product.hasOptions ? (
            <button
              className="btn solid wide"
              disabled={busy}
              onClick={async (e) => {
                const from = e.currentTarget;
                const ok = await add(
                  [{ productSlug: product.slug, quantity: 1, variant: "", config: { fabric: "", wood: "", metal: "" } }],
                  { from, image: img ? shopifyImage(img, 800) : null },
                );
                if (ok) onClose();
              }}
            >
              Add to basket · {formatPrice(product.priceCents)}
            </button>
          ) : (
            <Link href={`/product/${product.slug}`} className="btn solid wide" onClick={onClose}>
              {product.inStock ? "Choose colour / size →" : "See details"}
            </Link>
          )}
          <a
            className="btn wide wa-btn"
            href={whatsappLink(`Hello Muscat Furniture, I'm interested in: ${product.name} — ${formatPrice(product.priceCents)}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Order on WhatsApp
          </a>
          <Link href={`/product/${product.slug}`} className="link-btn" onClick={onClose}>
            {product.kind ? "Full details & 3D view →" : "Full details →"}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
