"use client";

import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { QtyStepper } from "@/components/commerce/CartDrawer";
import { useCart } from "@/components/commerce/CartProvider";
import { WhatsAppIcon } from "@/components/Nav";
import { shopifyImage } from "@/lib/images";
import { CATEGORIES } from "@/lib/catalog-data";
import { whatsappLink } from "@/lib/company";
import { DELIVERY, formatPrice, savingPercent, type DepthInfo, type Material, type Product } from "@/lib/types";
import { daylightAt } from "@/three/daylight";
import { frameFor } from "@/three/framing";
import { Furniture } from "@/three/Furniture";
import type { FurnitureKind } from "@/three/furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";
import { MattressLayers } from "./MattressLayers";
import { PopUp3D } from "./PopUp3D";
import { Stars } from "./Stars";

type Preset = "angle" | "front" | "side" | "top";

/** Glides the camera to a preset position, then hands control back to OrbitControls. */
function CameraDirector({
  goal,
  controls,
}: {
  goal: React.RefObject<THREE.Vector3 | null>;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    camera.position.lerp(g, 1 - Math.exp(-dt * 5));
    controls.current?.update();
    if (camera.position.distanceTo(g) < 0.01) goal.current = null;
  });
  return null;
}

/** Interactive 3D preview using the representative model for this kind of furniture. */
function Preview3D({ kind, fabric, wood }: { kind: FurnitureKind; fabric: string; wood: string }) {
  const [explode, setExplode] = useState(0);
  const [hour, setHour] = useState(15);
  const [spin, setSpin] = useState(true);
  const [preset, setPreset] = useState<Preset>("angle");
  const explodeRef = useRef(0);
  const hourRef = useRef(15);
  useEffect(() => {
    explodeRef.current = explode;
    hourRef.current = hour;
  }, [explode, hour]);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<THREE.Vector3 | null>(null);
  const mounted = useRef<number | null>(null);
  const frame = frameFor(kind, 1.15);
  const palette = { fabric, wood, metal: "#2b2b2b" };

  function goTo(p: Preset) {
    const [tx, ty, tz] = frame.target;
    const dist = new THREE.Vector3(...frame.position).distanceTo(new THREE.Vector3(...frame.target));
    const pos: Record<Preset, [number, number, number]> = {
      angle: frame.position,
      front: [tx, ty + dist * 0.12, tz + dist],
      side: [tx + dist, ty + dist * 0.12, tz],
      top: [tx + 0.001, ty + dist * 1.05, tz + 0.001],
    };
    goal.current = new THREE.Vector3(...pos[p]);
    setPreset(p);
    setSpin(false);
  }

  return (
    <div className="stage-3d" ref={setTrackEl}>
      <View style={{ position: "absolute", inset: 0 }}>
        <PerspectiveCamera makeDefault fov={32} position={frame.position} />
        {trackEl && (
          <OrbitControls
            ref={controls}
            domElement={trackEl}
            target={frame.target}
            enablePan={false}
            enableZoom={false}
            enableDamping
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={spin && explode < 0.05}
            autoRotateSpeed={0.6}
            onStart={() => {
              goal.current = null;
              setSpin(false);
            }}
          />
        )}
        <CameraDirector goal={goal} controls={controls} />
        <SceneLights hour={() => hourRef.current} shadowSize={2.5} />
        <ShadowFloor opacity={0.3} />
        <Furniture
          kind={kind}
          palette={palette}
          spread={0.8}
          glow={() => daylightAt(hourRef.current).glow}
          assembly={() => {
            mounted.current ??= performance.now();
            return Math.min(1, (performance.now() - mounted.current) / 2600);
          }}
          explode={() => explodeRef.current}
        />
      </View>
      <div className="view-presets" role="group" aria-label="Camera view">
        {(["angle", "front", "side", "top"] as Preset[]).map((p) => (
          <button key={p} aria-pressed={preset === p && !spin} onClick={() => goTo(p)}>
            {p === "angle" ? "3/4" : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <p className="preview-note">Representative 3D model — use it to preview style, colour and how it&apos;s built.</p>
      <div className="hud">
        <label className="explode">
          Exploded view · {Math.round(explode * 100)}%
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} />
        </label>
        <label className="explode">
          Light · {String(Math.floor(hour)).padStart(2, "0")}:00
          <input type="range" min={7} max={22} step={0.1} value={hour} onChange={(e) => setHour(+e.target.value)} />
        </label>
      </div>
    </div>
  );
}

// One size ladder for the whole site (cards, thumbnails, gallery), so a photo downloaded on the
// shop page is reused from the browser cache on the product page instead of fetched again.
const MAIN_SIZES = "(max-width: 999px) 100vw, 55vw";
const mainSrcSet = (src: string) => [400, 800, 1400].map((w) => `${shopifyImage(src, w)} ${w}w`).join(", ");

type Depth = DepthInfo & { src: string };

// The pop-up 3D photo (depth maps) is switched off; set true to show the "See it in 3D" button again.
const POP_UP_3D = false;

function Gallery({ images, name, slug, depth }: { images: string[]; name: string; slug: string; depth: Depth | null }) {
  const [i, setI] = useState(0);
  const [pop, setPop] = useState(false);
  const [ready, setReady] = useState<Record<number, boolean>>({});
  const markReady = (n: number) => setReady((r) => (r[n] ? r : { ...r, [n]: true }));

  // quietly fetch the neighbouring photos so the next click is instant
  const warm = (n: number) => {
    if (!images[n]) return;
    const im = new Image();
    im.sizes = MAIN_SIZES;
    im.srcset = mainSrcSet(images[n]);
  };
  // the main photo goes first; neighbours are fetched only once it has arrived
  useEffect(() => {
    if (!ready[i]) return;
    const t = setTimeout(() => {
      warm(i + 1);
      warm(i - 1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, images, ready[i]]);
  // thumbnails wait for the first photo so they don't compete with it on slow connections
  const showThumbs = ready[0] || i !== 0;

  if (!images.length) return <div className="gallery-main no-photo">No photo</div>;

  const main = (
    <div className={`gallery-main ${ready[i] ? "" : "loading"}`}>
      {/* the thumbnail (already downloaded) stands in, blurred, until the big photo arrives — never a blank area */}
      {!ready[i] && <img className="gallery-placeholder" src={shopifyImage(images[i], 400)} alt="" aria-hidden />}
      <img
        key={images[i]}
        className={`gm ${ready[i] ? "ready" : ""}`}
        src={shopifyImage(images[i], 800)}
        srcSet={mainSrcSet(images[i])}
        sizes={MAIN_SIZES}
        alt={name}
        decoding="async"
        fetchPriority={i === 0 ? "high" : "auto"}
        onLoad={() => markReady(i)}
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) markReady(i);
        }}
      />
      {/* the depth map belongs to the first photo */}
      {POP_UP_3D && depth && i === 0 && (
        <button className="pop3d-open" onClick={() => setPop(true)}>
          ✨ See it in 3D
        </button>
      )}
    </div>
  );
  const shown =
    POP_UP_3D && pop && depth && i === 0 ? <PopUp3D photo={shopifyImage(images[0], 800)} info={depth} onClose={() => setPop(false)} /> : main;

  return (
    <div className="gallery">
      {i === 0 ? <ViewTransition name={`photo-${slug}`}>{shown}</ViewTransition> : shown}
      {images.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Photos">
          {images.map((src, n) => (
            <button
              key={src}
              aria-pressed={n === i}
              aria-label={`Photo ${n + 1}`}
              onClick={() => setI(n)}
              onPointerEnter={() => warm(n)}
              onFocus={() => warm(n)}
            >
              {showThumbs && <img src={shopifyImage(src, 160)} alt="" loading="lazy" decoding="async" fetchPriority="low" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductExperience({
  product,
  materials,
  depth,
}: {
  product: Product;
  materials: Material[];
  depth: Depth | null;
}) {
  const { add, busy, error: cartError, setOpen } = useCart();
  const router = useRouter();
  const options = product.variants.filter((v) => v.title);
  const [variantTitle, setVariantTitle] = useState(options.find((v) => v.available)?.title ?? options[0]?.title ?? "");
  const variant = product.variants.find((v) => v.title === variantTitle) ?? product.variants[0];
  const price = variant?.price_cents ?? product.priceCents;
  const compareAt = variant ? variant.compare_at_cents : product.compareAtCents;
  const available = variant ? variant.available : product.inStock;
  const save = savingPercent(price, compareAt);
  const [qty, setQty] = useState(1);
  // mattresses open on what they are made of
  const layered = product.category === "mattresses";
  const [tab, setTab] = useState<"photos" | "3d" | "layers">(layered ? "layers" : "photos");

  // 3D preview colours: start from the product's own colour, let the customer try others
  const fabrics = materials.filter((m) => m.role === "fabric");
  const woods = materials.filter((m) => m.role === "wood");
  const [fabric, setFabric] = useState(product.colour || fabrics[0]?.hex || "#e8e0d2");
  const [wood, setWood] = useState(woods[1]?.hex ?? "#6b4a33");

  const category = CATEGORIES.find((c) => c.slug === product.category);
  const paragraphs = useMemo(() => product.description.split("\n").filter((l) => !l.startsWith("• ")), [product.description]);
  const addToBasket = (e?: React.MouseEvent<HTMLElement>) =>
    add([{ productSlug: product.slug, quantity: qty, variant: variantTitle, config: { fabric: "", wood: "", metal: "" } }], {
      from: e?.currentTarget,
      // same URL as the gallery photo, so the flying thumbnail is already in the browser cache
      image: product.images[0] ? shopifyImage(product.images[0], 800) : null,
    });
  const waText = () =>
    `Hello Muscat Furniture, I'm interested in: ${product.name}${variantTitle ? ` (${variantTitle})` : ""} × ${qty} — ${formatPrice(price)}. ${window.location.href}`;

  return (
    <div className="product">
      <div className="product-media">
        {(product.kind || layered) && (
          <div className="media-tabs" role="tablist" aria-label="Product views">
            {layered && (
              <button role="tab" aria-selected={tab === "layers"} onClick={() => setTab("layers")}>
                Layers
              </button>
            )}
            <button role="tab" aria-selected={tab === "photos"} onClick={() => setTab("photos")}>
              Photos
            </button>
            {product.kind && (
              <button role="tab" aria-selected={tab === "3d"} onClick={() => setTab("3d")}>
                View in 3D
              </button>
            )}
          </div>
        )}
        {tab === "layers" && layered ? (
          <MattressLayers name={product.name} description={product.description} />
        ) : tab === "3d" && product.kind ? (
          <Preview3D kind={product.kind} fabric={fabric} wood={wood} />
        ) : (
          <Gallery images={product.images} name={product.name} slug={product.slug} depth={depth} />
        )}
      </div>

      <section className="product-panel">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/shop">Shop</Link> /{" "}
          <Link href={`/shop?category=${product.category}`}>{category?.name ?? product.category}</Link>
        </nav>
        <div>
          <h1>{product.name}</h1>
          {product.nameAr && (
            <p className="name-ar big" dir="rtl" lang="ar">
              {product.nameAr}
            </p>
          )}
          <a href="#reviews" className="rating-link">
            <Stars rating={product.rating} count={product.reviewCount} />
          </a>
        </div>

        <div className="price-row">
          <strong>{formatPrice(price)}</strong>
          {save > 0 && compareAt && (
            <>
              <s>{formatPrice(compareAt)}</s>
              <span className="badge sale">Save {save}%</span>
            </>
          )}
          <span>VAT included</span>
        </div>
        <p className={`stock ${available ? "in" : "out"}`}>{available ? "● In stock" : "● Sold out — ask us on WhatsApp"}</p>

        {options.length > 0 && (
          <div>
            <p className="label">{product.variants.length > 1 ? "Choose an option" : "Option"}</p>
            <div className="chips wrap" role="group" aria-label="Options">
              {options.map((v) => (
                <button
                  key={v.title}
                  className={`chip ${v.title === variantTitle ? "on" : ""}`}
                  aria-pressed={v.title === variantTitle}
                  disabled={!v.available}
                  onClick={() => setVariantTitle(v.title)}
                >
                  {v.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.kind && (
          <div>
            <p className="label">Preview in other fabrics (3D)</p>
            <div className="swatch-row" role="group" aria-label="Preview fabric">
              {[...(product.colour ? [{ slug: "own", name: "As pictured", hex: product.colour }] : []), ...fabrics].map((m) => (
                <button
                  key={m.slug}
                  className="swatch sm"
                  style={{ "--c": m.hex } as React.CSSProperties}
                  aria-pressed={m.hex === fabric}
                  aria-label={m.name}
                  title={m.name}
                  onClick={() => {
                    setFabric(m.hex);
                    setTab("3d");
                  }}
                />
              ))}
              <span className="swatch-sep" />
              {woods.map((m) => (
                <button
                  key={m.slug}
                  className="swatch sm"
                  style={{ "--c": m.hex } as React.CSSProperties}
                  aria-pressed={m.hex === wood}
                  aria-label={m.name}
                  title={m.name}
                  onClick={() => {
                    setWood(m.hex);
                    setTab("3d");
                  }}
                />
              ))}
            </div>
            <p className="hint">Colour preview only. Available colours are the options listed above or in our showrooms.</p>
          </div>
        )}

        <div className="buy">
          <QtyStepper value={qty} label={product.name} onChange={(v) => setQty(Math.max(1, v))} />
          <button className="btn solid wide" onClick={addToBasket} disabled={busy || !available}>
            {busy ? "Adding…" : `Add to basket · ${formatPrice(price * qty)}`}
          </button>
        </div>
        <button
          className="btn wide buy-now"
          disabled={busy || !available}
          onClick={async () => {
            const ok = await add([
              { productSlug: product.slug, quantity: qty, variant: variantTitle, config: { fabric: "", wood: "", metal: "" } },
            ]);
            if (ok) {
              setOpen(false);
              router.push("/checkout");
            }
          }}
        >
          Buy now — pay cash on delivery
        </button>
        <a
          className="btn wide wa-btn"
          href={whatsappLink(`Hello Muscat Furniture, I'm interested in: ${product.name}`)}
          onClick={(e) => {
            // include the chosen option, quantity and page link at click time
            e.currentTarget.href = whatsappLink(waText());
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon size={18} /> Order on WhatsApp
        </a>
        {cartError && <p className="notice err">{cartError}</p>}

        <ul className="perks">
          <li>
            <b>Delivery</b> in {DELIVERY.days} anywhere in Oman ({DELIVERY.businessDays})
          </li>
          <li>
            <b>Free delivery</b> on orders over {formatPrice(DELIVERY.freeOverCents)}
          </li>
          <li>
            <b>Cash on delivery</b> · or visit one of our <Link href="/stores">6 showrooms</Link>
          </li>
        </ul>

        <div className="accordion">
          <details open>
            <summary>Description</summary>
            {paragraphs.map((p, n) => (
              <p key={n}>{p}</p>
            ))}
            {product.details.length > 0 && (
              <ul>
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {product.sku && <p className="hint">Code: {product.sku}</p>}
          </details>
          <details>
            <summary>Delivery &amp; returns</summary>
            <p>
              We deliver within Oman in {DELIVERY.days} from your order, {DELIVERY.businessDays}. Delivery is free on
              orders over {formatPrice(DELIVERY.freeOverCents)}; for smaller orders our team confirms the fee by phone
              before dispatch.
            </p>
            <p>
              Unused, unassembled items in their original packaging can be returned within 15 days of purchase.
              Assembled furniture, made-to-order and sale items can only be returned if faulty — tell us within 48
              hours of delivery.
            </p>
            <Link href="/help#returns" className="link-btn">
              Full returns policy
            </Link>
          </details>
        </div>
      </section>

      <div className="buy-bar">
        <div>
          <strong>{product.name}</strong>
          <span>{formatPrice(price * qty)}</span>
        </div>
        <button className="btn solid" onClick={addToBasket} disabled={busy || !available}>
          {busy ? "Adding…" : "Add to basket"}
        </button>
      </div>
    </div>
  );
}
