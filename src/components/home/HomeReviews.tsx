import Link from "next/link";
import { shopifyImage } from "@/lib/images";
import type { HomeReview } from "@/lib/types";

/**
 * What customers said, on the home page.
 *
 * A server component with no state: the reviews are fetched in the page and passed in,
 * so this adds nothing to the client bundle.
 *
 * It renders nothing at all when there are no approved reviews. The shop launched with
 * an empty reviews table, and a "What customers say" heading over empty space says
 * something worse about a shop than no section at all.
 */
export function HomeReviews({ reviews }: { reviews: HomeReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="section home-reviews" aria-labelledby="home-reviews-title">
      <div className="section-head">
        <h2 id="home-reviews-title">
          What customers <em>say.</em>
        </h2>
        <p>Real reviews from people who bought from us and had it delivered across Oman.</p>
      </div>

      <ul className="hrv-grid">
        {reviews.map((r) => (
          <li key={r.id} className="hrv-card">
            {/* aria-hidden: the rating is already announced in words below, so the
                decorative star row would otherwise be read out twice. */}
            <span className="hrv-stars" aria-hidden data-rating={r.rating} />
            <span className="sr-only">Rated {r.rating} out of 5</span>

            <h3 className="hrv-title">{r.title}</h3>
            <p className="hrv-body">{r.body}</p>

            <footer className="hrv-foot">
              <span className="hrv-who">
                <strong>{r.author}</strong>
                {r.isDemo && <span className="tag">Sample</span>}
              </span>

              <Link href={`/product/${r.productSlug}`} className="hrv-product">
                {r.productImage && (
                  // Plain <img>, as the product cards use: these are Shopify CDN URLs
                  // already resized by shopifyImage, so next/image would only re-proxy them.
                  <img src={shopifyImage(r.productImage, 96)} alt="" width={40} height={40} loading="lazy" decoding="async" />
                )}
                <span>{r.productName}</span>
              </Link>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
