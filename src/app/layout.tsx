import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CanvasRoot } from "@/components/CanvasRoot";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { CartProvider } from "@/components/commerce/CartProvider";
import { Nav } from "@/components/Nav";
import { getMaterials, getProducts } from "@/lib/catalog";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Atelier — Furniture that builds itself", template: "%s — Atelier" },
  openGraph: { type: "website", siteName: "Atelier", locale: "en_GB" },
  description:
    "Handmade furniture you can watch being built, touch in any material and live with at any hour — before it reaches your door.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, materials] = await Promise.all([getProducts(), getMaterials()]);
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <CartProvider materials={materials}>
          <CanvasRoot>
            <Nav products={products} />
            <div id="main">{children}</div>
            <CartDrawer />
          </CanvasRoot>
        </CartProvider>
      </body>
    </html>
  );
}
