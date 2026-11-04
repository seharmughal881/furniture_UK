import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Confetti } from "@/components/commerce/Confetti";
import { SofaBuddy } from "@/components/SofaBuddy";
import { whatsappLink } from "@/lib/company";
import { pool } from "@/lib/db";
import { DELIVERY, formatPrice } from "@/lib/types";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Thank you!", robots: { index: false } };

/**
 * Hides every digit but the last three, counting from the end of the whole string.
 *
 * Counted from the end rather than matched per group on purpose: phone numbers are stored
 * exactly as they were typed, so "9123 4567", "+968 9399 3950" and "00968 91234567" all
 * occur. A regex with a lookahead stops at each space and would leave most of the number
 * readable.
 */
function maskPhone(phone: string): string {
  let seen = 0;
  return [...phone]
    .reverse()
    .map((ch) => {
      if (!/\d/.test(ch)) return ch;
      seen += 1;
      return seen <= 3 ? ch : "•";
    })
    .reverse()
    .join("");
}

async function ThankYou({ params }: { params: PageProps<"/order/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { rows } = await pool.query(
    `SELECT o.number, o.name, o.address, o.address2, o.city, o.county, o.country, o.phone, o.landmark,
            o.created_at < now() - interval '7 days' AS "expired",
            o.delivery_fee_tbc AS "feeTbc", o.payment_method AS "payment", o.vat_cents AS "vat",
            o.subtotal_cents AS "subtotal", o.shipping_cents AS "shipping", o.total_cents AS "total",
            coalesce(json_agg(json_build_object('name', i.product_name, 'qty', i.quantity, 'price', i.unit_price_cents)
                     ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.id = $1 GROUP BY o.id`,
    [id],
  );
  const o = rows[0];
  if (!o) notFound();

  /*
   * This page's URL is its only credential: anyone holding the link sees the customer's
   * full name, phone number and street address, and the link never stops working. The id
   * is an unguessable gen_random_uuid() and the route is noindex, so the real exposure is
   * a link that outlives its usefulness -- forwarded in a chat, left in the history of a
   * shared or showroom computer.
   *
   * So the address and phone are shown for a week, which covers the delivery, and masked
   * afterwards. The order number and contents stay visible, which is what somebody
   * checking an old order actually needs.
   */
  const expired = Boolean(o.expired);
  const maskedPhone = maskPhone(String(o.phone ?? ""));
  const items = o.items as { name: string; qty: number; price: number }[];
  const first = String(o.name).trim().split(/\s+/)[0];
  const number = `#${String(o.number).padStart(5, "0")}`;

  return (
    <div className="thanks">
      <Confetti />
      <section className="thanks-hero">
        <div className="thanks-buddy">
          <SofaBuddy mood="party" size={200} />
          <svg className="thanks-check" viewBox="0 0 52 52" aria-hidden>
            <circle cx="26" cy="26" r="24" />
            <path d="M14 27 l8 8 l16 -18" />
          </svg>
        </div>
        <p className="label">Order {number} · confirmed</p>
        <h1>
          Thank you, <em>{first}!</em> <span className="wiggle" aria-hidden>🎉</span>
        </h1>
        <p className="thanks-ar" dir="rtl" lang="ar">
          شكراً لك! تم استلام طلبك بنجاح
        </p>
        <p className="lead">
          Your new furniture is on its way to becoming part of your home. We&apos;ll call or WhatsApp you on{" "}
          <b>{expired ? maskedPhone : o.phone}</b> to confirm and book a delivery time.
        </p>
        <div className="thanks-actions">
          <Link href="/shop" className="btn solid thanks-back">
            ← Go back to shopping
          </Link>
          <a className="btn wa-btn" href={whatsappLink(`Hello Muscat Furniture, about my order ${number}`)} target="_blank" rel="noopener noreferrer">
            Message us on WhatsApp
          </a>
        </div>
      </section>

      <ol className="thanks-timeline" aria-label="What happens next">
        <li className="done">
          <i>✓</i>
          <strong>Order placed</strong>
          <span>Just now</span>
        </li>
        <li>
          <i>📞</i>
          <strong>We call to confirm</strong>
          <span>Within one working day{o.feeTbc ? " — including the delivery fee" : ""}</span>
        </li>
        <li>
          <i>🚚</i>
          <strong>On its way</strong>
          <span>Delivered in {DELIVERY.days}</span>
        </li>
        <li>
          <i>🏠</i>
          <strong>Enjoy at home</strong>
          <span>Pay {o.payment === "cod" ? "cash on delivery" : "as agreed"}</span>
        </li>
      </ol>

      <div className="ticket">
        <div className="ticket-main">
          <p className="label">Your order</p>
          <ul>
            {items.map((it, i) => (
              <li key={i}>
                <span>
                  {it.name} <small>× {it.qty}</small>
                </span>
                <span>{formatPrice(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <span>Delivery</span>
            <span>{o.feeTbc ? "Confirmed by phone" : o.shipping === 0 ? "Free" : formatPrice(o.shipping)}</span>
          </div>
          <div className="row total-row">
            <span>Total</span>
            <strong>{formatPrice(o.total)}</strong>
          </div>
          {o.vat > 0 && <p className="hint">Includes VAT at 5%: {formatPrice(o.vat)}</p>}
        </div>
        <div className="ticket-stub">
          <p className="label">Order</p>
          <strong>{number}</strong>
          <p className="label">Delivering to</p>
          {expired ? (
            <p>
              {o.city}, {o.county}
              <br />
              <small>Full address hidden for privacy. Quote {number} if you need it.</small>
            </p>
          ) : (
            <p>
              {o.address}
              {o.address2 && `, ${o.address2}`}
              <br />
              {o.landmark && (
                <>
                  Near {o.landmark}
                  <br />
                </>
              )}
              {o.city}, {o.county}
            </p>
          )}
          <p className="label">Payment</p>
          <p>{o.payment === "cod" ? "Cash on delivery" : o.payment}</p>
        </div>
      </div>

      <p className="thanks-foot">
        <Link href="/shop" className="btn thanks-back">
          ← Go back to shopping
        </Link>
      </p>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[id]">) {
  return (
    <main className="section page">
      <Suspense fallback={<div className="thanks" aria-busy="true" />}>
        <ThankYou params={props.params} />
      </Suspense>
    </main>
  );
}
