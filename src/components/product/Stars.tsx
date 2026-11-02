/** Star rating, e.g. 4.5 (12). Renders nothing without reviews. */
export function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!rating || !count) return null;
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <span aria-hidden style={{ "--r": rating } as React.CSSProperties} />
      <small>
        {rating.toFixed(1)} ({count})
      </small>
    </span>
  );
}
