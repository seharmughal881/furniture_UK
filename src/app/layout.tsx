import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic, Instrument_Serif } from "next/font/google";
import { CanvasRoot } from "@/components/CanvasRoot";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { CartProvider } from "@/components/commerce/CartProvider";
import { MotionLayer } from "@/components/Motion";
import { Nav } from "@/components/Nav";
import { Welcome } from "@/components/Welcome";
import { ViewTransition } from "react";
import { getMaterials, getProductIndex } from "@/lib/catalog";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Muscat Furniture — Sofas, bedroom sets, lighting | Oman", template: "%s — Muscat Furniture" },
  openGraph: { type: "website", siteName: "Muscat Furniture", locale: "en_OM", alternateLocale: ["ar_OM"] },
  description:
    "Sofa sets, bedroom sets, dining, mattresses and lighting from Muscat Furniture. See furniture in 3D, plan your room, order online or on WhatsApp — delivered across Oman.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, materials] = await Promise.all([getProductIndex(), getMaterials()]);
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
      <body>
        <Welcome />
        <CartProvider materials={materials}>
          <CanvasRoot>
            <Nav products={products} />
            <MotionLayer />
            {/* crossfades pages on navigation; product photos morph via named transitions */}
            <ViewTransition>
              <div id="main">{children}</div>
            </ViewTransition>
            <CartDrawer />
          </CanvasRoot>
        </CartProvider>
      </body>
    </html>
  );
}
