"use client";

import { useState } from "react";
import { Stars } from "@/components/home/Collection";
import type { Review } from "@/lib/types";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Reviews({ productSlug, productName, initial }: { productSlug: string; productName: string; initial: Review[] }) {
  const [reviews, setReviews] = useState(initial);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug, rating, author: f.get("author"), title: f.get("title"), body: f.get("body") }),
    }).catch(() => null);
    if (!res?.ok) return setState("error");
    const { review } = await res.json();
    setReviews((rs) => [review, ...rs]);
    setWriting(false);
    setState("idle");
  }

  return (
    <section className="section reviews" id="reviews" aria-labelledby="reviews-title">
      <div className="reviews-grid">
        <div className="reviews-summary">
          <h2 id="reviews-title">Reviews</h2>
          {avg ? (
            <>
              <div className="big-rating">{avg.toFixed(1)}</div>
              <Stars rating={avg} count={count} />
              <ul className="dist">
                {dist.map((d) => (
                  <li key={d.n}>
                    <span>{d.n}★</span>
                    <i>
                      <b style={{ width: `${count ? (d.c / count) * 100 : 0}%` }} />
                    </i>
                    <span>{d.c}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">No reviews yet. Be the first to review the {productName}.</p>
          )}
          <button className="btn" onClick={() => setWriting((v) => !v)} aria-expanded={writing}>
            {writing ? "Cancel" : "Write a review"}
          </button>
        </div>

        <div>
          {writing && (
            <form className="form review-form" onSubmit={submit}>
              <div className="star-input" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={n <= rating ? "on" : ""}
                    onClick={() => setRating(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input name="author" placeholder="Your name" required maxLength={80} />
              <input name="title" placeholder="Headline" required maxLength={120} />
              <textarea name="body" rows={4} placeholder="What do you like, and what could be better? (10+ characters)" required minLength={10} maxLength={2000} />
              {state === "error" && <p className="notice err">Please fill in every field (review at least 10 characters).</p>}
              <button className="btn solid" disabled={state === "sending"}>
                {state === "sending" ? "Posting…" : "Post review"}
              </button>
            </form>
          )}
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="review-head">
                  <Stars rating={r.rating} count={1} />
                  {r.isDemo && <span className="tag">Sample review</span>}
                </div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <small>
                  {r.author} · {fmtDate(r.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
