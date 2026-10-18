import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { pool } from "@/lib/db";
import { formatPrice, SHIPPING, type ShippingMethod } from "@/lib/types";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

async function Order({ params }: { params: PageProps<"/order/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { rows } = await pool.query(
    `SELECT o.number, o.email, o.name, o.address, o.address2, o.city, o.county, o.postcode, o.country,
            o.shipping_method AS "shippingMethod", o.vat_cents AS "vat",
            o.subtotal_cents AS "subtotal", o.shipping_cents AS "shipping", o.total_cents AS "total",
            coalesce(json_agg(json_build_object('name', i.product_name, 'qty', i.quantity, 'price', i.unit_price_cents)
                     ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.id = $1 GROUP BY o.id`,
    [id],
  );
  const o = rows[0];
  if (!o) notFound();
  const items = o.items as { name: string; qty: number; price: number }[];

  return (
    <div className="order">
      <p className="label">Order #{String(o.number).padStart(5, "0")}</p>
      <h1>
        Thank you, <em>{o.name.split(" ")[0]}.</em>
      </h1>
      <p className="lead">
        Your order is with our studio. We&apos;ll email <b>{o.email}</b> within one working day to confirm materials,
        take payment and book your delivery.
      </p>
      <p className="demo-banner" role="note">
        Demo store — no payment has been taken.
      </p>
      <div className="order-grid">
        <div className="summary">
          <h2>What you ordered</h2>
          <ul>
            {items.map((it, i) => (
              <li key={i}>
                <strong>
                  {it.name} <span>× {it.qty}</span>
                </strong>
                <span>{formatPrice(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <span>Subtotal</span>
            <span>{formatPrice(o.subtotal)}</span>
          </div>
          <div className="row">
            <span>{SHIPPING[o.shippingMethod as ShippingMethod]?.label ?? "Delivery"}</span>
            <span>{o.shipping === 0 ? "Free" : formatPrice(o.shipping)}</span>
          </div>
          <div className="row total-row">
            <span>Total</span>
            <strong>{formatPrice(o.total, true)}</strong>
          </div>
          {o.vat > 0 && (
            <div className="row vat-row">
              <span>Includes VAT at 20%</span>
              <span>{formatPrice(o.vat, true)}</span>
            </div>
          )}
        </div>
        <div>
          <h2>Delivering to</h2>
          <p>
            {o.name}
            <br />
            {o.address}
            <br />
            {o.address2 && (
              <>
                {o.address2}
                <br />
              </>
            )}
            {o.city}
            {o.county && `, ${o.county}`}
            <br />
            {o.postcode}
            <br />
            {o.country}
          </p>
          <h2>What happens next</h2>
          <p className="hint">
            You can cancel within 14 days of delivery for a full refund. This does not affect your statutory rights.
          </p>
          <ol className="steps">
            <li>We confirm your order and take payment.</li>
            <li>Your maker starts work. We send photos from the workshop.</li>
            <li>We call to book a delivery day that suits you.</li>
          </ol>
          <Link href="/shop" className="btn">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[id]">) {
  return (
    <main className="section page">
      <Suspense fallback={<div className="order" aria-busy="true" />}>
        <Order params={props.params} />
      </Suspense>
    </main>
  );
}
