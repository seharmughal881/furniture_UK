import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic, Instrument_Serif } from "next/font/google";
import { getCompany } from "@/lib/content/company";
import { getContent } from "@/lib/content/read";

/**
 * Thin root layout: the document shell only.
 *
 * The storefront chrome (welcome screen, basket, the shared WebGL canvas, header) lives in
 * app/(site)/layout.tsx, and the back office has its own in app/admin/layout.tsx. Keeping
 * this file free of both means /admin never downloads three.js, never renders the shop
 * header, and never pays for the two catalogue queries the storefront needs.
 *
 * The fonts stay here, on <html>, so both sections can use them -- the Arabic face in
 * particular, because customer names and landmarks on an admin delivery note are often
 * written in Arabic.
 */

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

/**
 * Titles, description and sharing picture come from the back office ("Search engines &
 * sharing"), so the owner can change how the site appears in results without a deploy.
 *
 * generateMetadata, not a static object, because reading them touches the database. It is
 * cached for hours under the "content" tag like every other block.
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContent<{
    title: string;
    titleTemplate: string;
    description: string;
    shareImage: string;
  }>("seo");
  const company = await getCompany();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: seo.title, template: seo.titleTemplate },
    description: seo.description,
    openGraph: {
      type: "website",
      siteName: company.tradingName,
      locale: "en_OM",
      alternateLocale: ["ar_OM"],
      title: seo.title,
      description: seo.description,
      ...(seo.shareImage ? { images: [seo.shareImage] } : {}),
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script below may add data-welcomed to <html> before React loads
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${arabic.variable}`} suppressHydrationWarning>
      <head>
        {/* product photos come from Shopify's CDN: open the connection early, once per page */}
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.shopify.com" />
        {/* the welcome screen shows every time the home page is opened, refresh included; on every other
            page it is hidden here, before paint, so it never flashes. ?welcome shows it on any page. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(location.pathname!=="/"&&!/[?&]welcome/.test(location.search))document.documentElement.dataset.welcomed="1"`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
