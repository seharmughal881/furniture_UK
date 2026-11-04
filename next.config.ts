import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy.
 *
 * Set here rather than with a per-request nonce in proxy.ts, deliberately. Next's own CSP
 * guide (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md) states
 * that nonces require every page to be dynamically rendered and that "Partial Prerendering
 * is incompatible with nonce-based CSP". This app runs with cacheComponents and
 * partialPrefetching on, so a nonce would throw away every static shell on the site.
 *
 * The cost of that choice is 'unsafe-inline' for scripts: React's streaming bootstrap
 * (`self.__next_f.push(...)`) and the pre-paint welcome script in app/layout.tsx are both
 * inline, and a hash cannot cover the former. Note that adding a hash or nonce would make
 * browsers *ignore* 'unsafe-inline', so the two cannot be mixed.
 *
 * What this policy still buys, which is most of the value here given the app has no XSS
 * sink today: scripts cannot be loaded from another origin, the page cannot be framed,
 * <base> cannot be hijacked, forms cannot post to another site, and plugins are blocked.
 *
 * To tighten this to a nonce later, drop cacheComponents/partialPrefetching first.
 */
const SHOPIFY_CDN = "https://cdn.shopify.com";
// Vercel Blob: uploads are sent to the first host, and finished files are served from the
// second (the store id is a subdomain), so both are needed for admin image uploads.
const BLOB_UPLOAD = "https://blob.vercel-storage.com";
const BLOB_FILES = "https://*.public.blob.vercel-storage.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Inline style attributes are used throughout the storefront (progress bars, 3D overlays).
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SHOPIFY_CDN} ${BLOB_FILES}`,
  // Product videos stream from Shopify's CDN.
  `media-src 'self' blob: ${SHOPIFY_CDN}`,
  // next/font self-hosts the Google fonts at build time, so 'self' is enough.
  "font-src 'self' data:",
  // GLTFLoader fetches models from our own /api/models/*; the dev websocket is for HMR.
  `connect-src 'self' ${SHOPIFY_CDN} ${BLOB_UPLOAD} ${BLOB_FILES}${isDev ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Omitted in development, where the site is served over plain http on localhost.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // frame-ancestors above covers modern browsers; this covers the rest.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Only meaningful over https, and would be wrong to send from localhost.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // The client preview (npm run preview) builds into its own folder so the dev server,
  // which uses .next, can be restarted or cleaned without breaking the preview.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // The thank-you page shows a customer's name, phone and street address. Keep it
        // out of search engines, never leak its URL to another site in a Referer header,
        // and make sure no shared cache or CDN keeps a copy.
        source: "/order/:id",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        // Per-visitor endpoints. Scoped to these three rather than all of /api, because
        // /api/models/:slug/file deliberately sets a long public cache for its GLB.
        source: "/api/cart/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      { source: "/api/checkout", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/api/rooms/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      {
        // Nothing in the back office should ever be cached or indexed.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
