// Business identity, from muscatfurniture.com (contact page and policies, October 2026).
// Oman's e-commerce rules (Ministerial Decision 499/2023) expect the commercial registration (CR)
// and e-commerce licence to be shown; they are not published on the current site, so the client must supply them.
export const COMPANY = {
  tradingName: "Muscat Furniture",
  tradingNameAr: "مسقط للأثاث",
  legalName: "[legal company name]",
  crNumber: "[CR number]",
  licenceNumber: "[e-commerce licence number]",
  vatNumber: "[VAT registration number]",
  address: "Azaiba North, House 800, Way 7014, Muscat, P.O. Box 1182, PC 121, Sultanate of Oman",
  email: "onlinepur@mfi.om",
  complaintsEmail: "complaint@muscatfurniture.com",
  phone: "+968 9399 3950",
  /** Number used by "Order on WhatsApp" on the current site. */
  whatsapp: "96893993950",
  instagram: "https://www.instagram.com/muscatfurniture",
  facebook: "https://www.facebook.com/MuscatFurnitureInternational",
  isPlaceholder: true,
};

export const whatsappLink = (text: string) => `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent(text)}`;
