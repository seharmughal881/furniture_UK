"use client";

import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { QtyStepper } from "@/components/commerce/CartDrawer";
import { useCart } from "@/components/commerce/CartProvider";
import { frameFor, Stars } from "@/components/home/Collection";
import { CATEGORIES } from "@/lib/catalog-data";
import { formatPrice, SHIPPING, type Material, type MaterialRole, type Product } from "@/lib/types";
import { daylightAt } from "@/three/daylight";
import { DimensionGuides } from "@/three/DimensionGuides";
import { ROLES_FOR } from "@/three/furniture";
import { Furniture } from "@/three/Furniture";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";

const ROLE_LABEL: Record<MaterialRole, string> = { fabric: "Upholstery", wood: "Timber", metal: "Metal" };
type Preset = "angle" | "front" | "side" | "top";

// Upholstered pieces in scope of the UK furniture fire safety regulations (mattresses and bed bases are
// excluded, but an upholstered headboard is covered).
const UPHOLSTERED: Product["kind"][] = ["sofa", "armchair", "sectional", "pouf", "bench", "diningChair", "officeChair", "bed"];
// Electrical items covered by the WEEE take-back duty.
const ELECTRICAL: Product["kind"][] = ["floorLamp", "tableLamp"];

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

// Delivery window from today, read on the client only (no server clock in the static shell).
const noop = () => () => {};
function useDeliveryWindow(weeks: number) {
  return useSyncExternalStore(
    noop,
    () => {
      const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const from = new Date(Date.now() + weeks * 7 * 86400000);
      const to = new Date(from.getTime() + 7 * 86400000);
      return `${fmt(from)} – ${fmt(to)}`;
    },
    () => null,
  );
}

export function ProductExperience({ product, materials }: { product: Product; materials: Material[] }) {
  const { add, busy, error: cartError } = useCart();
  const roles = ROLES_FOR[product.kind];
  const byRole = (r: MaterialRole) => materials.filter((m) => m.role === r);
  const [choice, setChoice] = useState<Record<MaterialRole, Material>>({
    fabric: byRole("fabric")[0],
    wood: byRole("wood")[0],
    metal: byRole("metal")[0],
  });
  const [qty, setQty] = useState(1);
  const [explode, setExplode] = useState(0);
  const [hour, setHour] = useState(14);
  const [showDims, setShowDims] = useState(false);
  const [spin, setSpin] = useState(true);
  const [preset, setPreset] = useState<Preset>("angle");
  // the render loop reads these every frame without re-rendering the scene
  const explodeRef = useRef(0);
  const hourRef = useRef(14);
  useEffect(() => {
    explodeRef.current = explode;
    hourRef.current = hour;
  }, [explode, hour]);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<THREE.Vector3 | null>(null);

  const frame = frameFor(product.kind, 1.15);
  const palette = { fabric: choice.fabric.hex, wood: choice.wood.hex, metal: choice.metal.hex };
  const mounted = useRef<number | null>(null);
  const delivery = useDeliveryWindow(product.leadTimeWeeks);
  const category = CATEGORIES.find((c) => c.slug === product.category);
  const config = {
    fabric: roles.includes("fabric") ? choice.fabric.slug : "",
    wood: roles.includes("wood") ? choice.wood.slug : "",
    metal: roles.includes("metal") ? choice.metal.slug : "",
  };

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

  const addToCart = () => add([{ productSlug: product.slug, quantity: qty, config }]);

  // quote form
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productSlug: product.slug,
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
        config: { fabric: choice.fabric.slug, wood: choice.wood.slug, metal: choice.metal.slug },
      }),
    }).catch(() => null);
    if (res?.ok) setStatus("sent");
    else {
      setStatus("error");
      const body = await res?.json().catch(() => null);
      setError(body?.issues ? Object.keys(body.issues).join(", ") + " looks wrong." : "Something went wrong.");
    }
  }

  return (
    <div className="product">
      <div className="product-stage" ref={setTrackEl}>
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
              autoRotate={spin && explode < 0.05 && !showDims}
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
            kind={product.kind}
            palette={palette}
            spread={0.8}
            glow={() => daylightAt(hourRef.current).glow}
            assembly={() => {
              mounted.current ??= performance.now();
              return Math.min(1, (performance.now() - mounted.current) / 2600);
            }}
            explode={() => explodeRef.current}
          />
          {showDims && <DimensionGuides widthCm={product.widthCm} depthCm={product.depthCm} heightCm={product.heightCm} />}
        </View>

        <div className="view-presets" role="group" aria-label="Camera view">
          {(["angle", "front", "side", "top"] as Preset[]).map((p) => (
            <button key={p} aria-pressed={preset === p && !spin} onClick={() => goTo(p)}>
              {p === "angle" ? "3/4" : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button aria-pressed={showDims} onClick={() => setShowDims((v) => !v)}>
            Dimensions
          </button>
        </div>

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

      <section className="product-panel">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/shop">Shop</Link> /{" "}
          <Link href={`/shop?category=${product.category}`}>{category?.name ?? product.category}</Link>
        </nav>
        <div>
          <h1>{product.name}</h1>
          <p className="tagline">{product.tagline}</p>
          <a href="#reviews" className="rating-link">
            <Stars rating={product.rating} count={product.reviewCount} />
          </a>
        </div>

        <div className="price-row">
          <strong>{formatPrice(product.priceCents)}</strong>
          <span>inc. VAT · made to order · ships in {product.leadTimeWeeks} weeks</span>
        </div>

        {roles.map((role) => (
          <div key={role}>
            <p className="label">
              {ROLE_LABEL[role]} — <span style={{ color: "var(--ink)" }}>{choice[role].name}</span>
            </p>
            <div className="swatch-row" role="group" aria-label={ROLE_LABEL[role]}>
              {byRole(role).map((m) => (
                <button
                  key={m.slug}
                  className="swatch"
                  style={{ "--c": m.hex } as React.CSSProperties}
                  aria-pressed={m.slug === choice[role].slug}
                  aria-label={m.name}
                  title={`${m.name} — ${m.note}`}
                  onClick={() => setChoice((c) => ({ ...c, [role]: m }))}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="buy">
          <QtyStepper value={qty} label={product.name} onChange={(v) => setQty(Math.max(1, v))} />
          <button className="btn solid wide" onClick={addToCart} disabled={busy}>
            {busy ? "Adding…" : `Add to basket · ${formatPrice(product.priceCents * qty)}`}
          </button>
        </div>
        {cartError && <p className="notice err">{cartError}</p>}

        <ul className="perks">
          <li>
            <b>Estimated delivery</b> {delivery ?? `in ${product.leadTimeWeeks}–${product.leadTimeWeeks + 1} weeks`}
          </li>
          <li>
            <b>Delivery</b> {formatPrice(SHIPPING.standard.cents)} to any UK address, free over{" "}
            {formatPrice(SHIPPING.standard.freeOverCents)} — Highlands, islands and Northern Ireland included
          </li>
          <li>
            <b>100-night home trial</b> · on top of your 14-day legal right to cancel
          </li>
          {UPHOLSTERED.includes(product.kind) && (
            <li>
              <b>Fire safety</b> meets the Furniture and Furnishings (Fire) (Safety) Regulations 1988 — permanent label
              fitted
            </li>
          )}
          {ELECTRICAL.includes(product.kind) && (
            <li>
              <b>Free old-lamp take-back</b> when we deliver (WEEE Regulations) — <Link href="/help#weee">details</Link>
            </li>
          )}
        </ul>

        <div className="accordion">
          <details open>
            <summary>Details</summary>
            <p>{product.description}</p>
            <ul>
              {product.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Dimensions</summary>
            <div className="spec">
              <div>
                <p className="label">Width</p>
                <strong>{product.widthCm} cm</strong>
              </div>
              <div>
                <p className="label">Depth</p>
                <strong>{product.depthCm} cm</strong>
              </div>
              <div>
                <p className="label">Height</p>
                <strong>{product.heightCm} cm</strong>
              </div>
            </div>
            <button className="link-btn" onClick={() => setShowDims(true)}>
              Show dimensions on the 3D model
            </button>
          </details>
          <details>
            <summary>Materials &amp; care</summary>
            <p>{product.care}</p>
            <ul>
              {roles.map((r) => (
                <li key={r}>
                  {ROLE_LABEL[r]}: {choice[r].name} — {choice[r].note}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Delivery &amp; returns</summary>
            <p>
              {SHIPPING.standard.label} ({SHIPPING.standard.note}) is {formatPrice(SHIPPING.standard.cents)}, free over{" "}
              {formatPrice(SHIPPING.standard.freeOverCents)}. {SHIPPING.whiteGlove.label} ({SHIPPING.whiteGlove.note}) is{" "}
              {formatPrice(SHIPPING.whiteGlove.cents)}. Same price for every UK postcode.
            </p>
            <p>
              You can cancel within 14 days of delivery for a full refund, and our 100-night trial gives you longer. If
              anything arrives faulty you can reject it for a full refund within 30 days (Consumer Rights Act 2015).
            </p>
            <Link href="/help#returns" className="link-btn">
              Read our returns policy
            </Link>
          </details>
          <details>
            <summary>Trade &amp; custom quotes</summary>
            {status === "sent" ? (
              <p className="notice">Thank you. Our studio will reply within one working day.</p>
            ) : (
              <form className="form" onSubmit={submit}>
                <p className="hint">Buying for a hotel, office or several rooms? Ask for a quote on this configuration.</p>
                <input name="name" placeholder="Your name" required autoComplete="name" />
                <input name="email" type="email" placeholder="Email" required autoComplete="email" />
                <textarea name="message" rows={3} placeholder="Quantities, timeline, anything else (optional)" />
                {status === "error" && <p className="notice err">{error}</p>}
                <button className="btn" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Request quote"}
                </button>
              </form>
            )}
          </details>
        </div>
      </section>

      <div className="buy-bar">
        <div>
          <strong>{product.name}</strong>
          <span>{formatPrice(product.priceCents * qty)}</span>
        </div>
        <button className="btn solid" onClick={addToCart} disabled={busy}>
          {busy ? "Adding…" : "Add to basket"}
        </button>
      </div>
    </div>
  );
}
