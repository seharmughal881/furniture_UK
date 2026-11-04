"use client";

import { useState } from "react";
import { Stars } from "./Stars";
import type { Review } from "@/lib/types";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Reviews({ productSlug, productName, initial }: { productSlug: string; productName: string; initial: Review[] }) {
  // Plain, not state: a submitted review is held for approval rather than added to the
  // list, so what is shown here only ever changes on a fresh load from the server.
  const reviews = initial;
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [state, setState] = useState<"idle" | "sending" | "error" | "thanks">("idle");
  const [message, setMessage] = useState("");

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

    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      // The server explains a rate limit ("already reviewed this product today") far
      // better than a generic failure can, so show its message when there is one.
      setMessage(body?.error ?? "Please fill in every field (review at least 10 characters).");
      setState("error");
      return;
    }

    // Reviews are now held for approval, so the new one is NOT added to the list here --
    // showing it would imply it is published, and it would vanish on the next reload.
    setWriting(false);
    setMessage("Thank you! Your review will appear once our team has read it.");
    setState("thanks");
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
              {state === "error" && <p className="notice err">{message}</p>}
              <button className="btn solid" disabled={state === "sending"}>
                {state === "sending" ? "Posting…" : "Post review"}
              </button>
            </form>
          )}
          {/* Shown after the form closes, so the thank-you survives the form unmounting. */}
          {state === "thanks" && (
            <p className="notice" role="status">
              {message}
            </p>
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
