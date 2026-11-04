import { Suspense } from "react";
import { AdminHeader } from "./_components/AdminHeader";
import "./admin.css";

export const metadata = {
  title: "Back office",
  robots: { index: false, follow: false },
};

/**
 * Opt the admin subtree out of instant-navigation validation. Every admin page reads the
 * session cookie, so none of them can have a static shell -- that is correct here, and
 * this stops Next reporting it as a problem on each page. The storefront keeps validating.
 */
export const instant = false;

/**
 * Admin shell. Nested inside the thin root layout, so it inherits <html>, <body> and the
 * fonts but none of the storefront chrome: no WebGL canvas, no shop header, no basket.
 *
 * Note what this layout does NOT do: read the session. A Next layout is cached and does
 * not rerender between navigations, so a check here would not be a security boundary, and
 * awaiting the session at a layout's top level would hold the whole segment. The header
 * reads it inside its own Suspense boundary instead, and the real guard lives in
 * src/lib/admin/orders.ts, next to the data.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="adm">
      <Suspense fallback={<div className="adm-bar" />}>
        <AdminHeader />
      </Suspense>
      <main className="adm-main">
        <Suspense fallback={<p className="adm-loading">Loading…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
