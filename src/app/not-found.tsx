import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section page empty">
      <p className="label">404</p>
      <h1>This page has been taken apart.</h1>
      <p>We couldn&apos;t find what you were looking for.</p>
      <Link href="/shop" className="btn">
        Back to the collection
      </Link>
    </main>
  );
}
