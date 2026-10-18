"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="section page empty">
      <p className="label">Something went wrong</p>
      <h1>A joint came loose.</h1>
      <p>Please try again. If it keeps happening, contact the studio.</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
