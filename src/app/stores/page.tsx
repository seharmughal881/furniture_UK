import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { getStores } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Showrooms",
  description: "Visit Muscat Furniture in Muscat (Al Hail North), Sohar, Barka, Al-Bidaya, Nizwa and Salalah.",
};

const digits = (s: string) => s.replace(/[^\d]/g, "");

export default async function StoresPage() {
  const stores = await getStores();
  return (
    <main>
      <section className="section page">
        <p className="label">Showrooms</p>
        <h1 className="page-title">Visit us across Oman</h1>
        <p className="hint" style={{ maxWidth: 560 }}>
          See and sit on our sofa sets, bedroom sets and dining tables in person. Every showroom can take your order
          and arrange delivery.
        </p>
        <div className="store-grid">
          {stores.map((s) => (
            <article key={s.slug} className="store-card">
              <p className="label">{s.kind === "office" ? "Head office" : s.city}</p>
              <h2>{s.name}</h2>
              <p>{s.address}</p>
              {s.hours && <p className="hint">{s.hours}</p>}
              <div className="store-actions">
                {s.phone && (
                  <a className="chip" href={`tel:+${digits(s.phone)}`}>
                    Call {s.phone}
                  </a>
                )}
                {s.whatsapp && (
                  <a className="chip wa-chip" href={`https://wa.me/${digits(s.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                )}
                <a
                  className="chip"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Muscat Furniture ${s.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Map
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
