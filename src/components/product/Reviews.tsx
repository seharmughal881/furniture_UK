"use client";

import { useState } from "react";
import { Stars } from "./Stars";
import type { Review } from "@/lib/types";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Cards shown at once; past this the arrows and dots appear. */
const PER_PAGE = 4;

/**
 * The monogram that stands in for a photo.
 *
 * A review stores a name, a rating and the words -- there is no avatar column and no
 * upload, so the circle is drawn from the writer's initials rather than filled with a
 * stock face that would not belong to them.
 */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const StarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="m12 2.8 2.7 5.8 6.3.8-4.6 4.4 1.2 6.4L12 17.1l-5.6 3.1 1.2-6.4-4.6-4.4 6.3-.8Z" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 1.9" />
  </svg>
);

export function Reviews({
  productSlug,
  productName,
  initial,
}: {
  productSlug: string;
  productName: string;
  initial: Review[];
}) {
  // Plain, not state: a submitted review is held for approval rather than added to the
  // list, so what is shown here only ever changes on a fresh load from the server.
  const reviews = initial;
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [state, setState] = useState<"idle" | "sending" | "error" | "thanks">("idle");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);

  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  // A measured figure rather than a slogan: the share of reviews giving four or five stars.
  const happy = count ? Math.round((reviews.filter((r) => r.rating >= 4).length / count) * 100) : 0;

  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = reviews.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

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
      <div className="section-head">
        <h2 id="reviews-title">
          What customers <em>say</em>
        </h2>
      </div>

      <div className="reviews-grid">
        <aside className="reviews-summary">
          <p className="rv-label">
            <StarIcon /> Overall rating
          </p>

          {avg ? (
            <>
              <p className="big-rating">
                {avg.toFixed(1)}
                <small>/ 5</small>
              </p>
              <div className="rv-stars-big">
                <Stars rating={avg} count={count} />
              </div>
              <p className="rv-based">
                Based on {count} {count === 1 ? "review" : "reviews"}
              </p>

              <div className="rv-seal">
                <span className="rv-seal-n">{happy}%</span>
                <span className="rv-seal-t">rated it 4 stars or more</span>
              </div>

              <ul className="dist">
                {dist.map((d) => (
                  <li key={d.n}>
                    <span>{d.n} ★</span>
                    <i>
                      <b style={{ width: `${count ? (d.c / count) * 100 : 0}%` }} />
                    </i>
                    <span className="dist-n">{d.c}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">No reviews yet. Be the first to review the {productName}.</p>
          )}

          <button className="rv-write" onClick={() => setWriting((v) => !v)} aria-expanded={writing} aria-controls="review-form">
            {writing ? "Cancel" : "Write a review"}
            <span aria-hidden>{writing ? "×" : "→"}</span>
          </button>
        </aside>

        <div className="rv-main">
          {writing && (
            <form id="review-form" className="form review-form" onSubmit={submit}>
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
              <textarea
                name="body"
                rows={4}
                placeholder="What do you like, and what could be better? (10+ characters)"
                required
                minLength={10}
                maxLength={2000}
              />
              {state === "error" && <p className="notice err">{message}</p>}
              <div className="form-actions">
                <button className="btn solid" disabled={state === "sending"}>
                  {state === "sending" ? "Posting…" : "Post review"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setWriting(false);
                    // drop the message with the form, so reopening it starts clean
                    setState("idle");
                    setMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {/* Shown after the form closes, so the thank-you survives the form unmounting. */}
          {state === "thanks" && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          {count > 0 && (
            <ul className="review-list">
              {shown.map((r) => (
                <li key={r.id}>
                  <span className="rv-quote" aria-hidden />
                  <div className="review-head">
                    <span className="rv-avatar" aria-hidden>
                      {initials(r.author)}
                    </span>
                    <span className="rv-who">
                      <strong>{r.author}</strong>
                      <Stars rating={r.rating} count={1} />
                    </span>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.body}</p>
                  <footer className="rv-foot">
                    <small>
                      <ClockIcon /> {fmtDate(r.createdAt)}
                    </small>
                    {r.isDemo && <span className="tag">Sample review</span>}
                  </footer>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav className="rv-pager" aria-label="More reviews">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, current - 1))}
                disabled={current === 0}
                aria-label="Previous reviews"
              >
                ‹
              </button>
              {pages <= 7 ? (
                <span className="rv-dots">
                  {Array.from({ length: pages }, (_, n) => (
                    <button
                      type="button"
                      key={n}
                      className={n === current ? "on" : ""}
                      aria-label={`Reviews ${n + 1} of ${pages}`}
                      aria-current={n === current ? "true" : undefined}
                      onClick={() => setPage(n)}
                    />
                  ))}
                </span>
              ) : (
                <span className="rv-count">
                  {current + 1} / {pages}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPage(Math.min(pages - 1, current + 1))}
                disabled={current === pages - 1}
                aria-label="Next reviews"
              >
                ›
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
