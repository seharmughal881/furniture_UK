import type { Store } from "./types";

/**
 * What a showroom page needs beyond the `stores` table: a weekly timetable the page can
 * reason about ("open now"), what to ask Google Maps for, and the showroom's own video.
 *
 * Kept in code rather than new columns so the page ships without a database migration.
 * The `stores` row stays the source of truth for name, address, phone and the hours text.
 */

/** Minutes after midnight, Muscat time. */
type Span = [open: number, close: number];
/** Index 0 = Sunday ... 6 = Saturday, as Date#getDay() counts. */
export type Week = Span[][];

const h = (hour: number, min = 0) => hour * 60 + min;

// Both timetables are the ones published on muscatfurniture.com/pages/contact and already
// stored as text in `stores.hours` (see scripts/import-muscat.ts, HOURS_A / HOURS_B).
const FRIDAY: Span[] = [[h(16, 30), h(21)]];
const SPLIT: Span[] = [[h(9), h(13)], [h(16), h(22)]]; // HOURS_A, Sat–Thu
const LONG: Span[] = [[h(9), h(22)]]; // HOURS_B, Sat–Thu
const week = (satToThu: Span[]): Week => [satToThu, satToThu, satToThu, satToThu, satToThu, FRIDAY, satToThu];

/**
 * Google Street View of the shop. `pin` is the shop's own pin on Google Maps (read from its
 * listing, November 2026); `heading` is the compass direction the camera starts facing,
 * chosen by eye so the shop sign is in frame. `inside` marks a 360° tour inside the shop.
 */
export type StreetView = { pin: [lat: number, lng: number]; heading: number; inside?: boolean };

export type Showroom = {
  /** Weekly opening times, or null for the head office (no walk-in hours). */
  week: Week | null;
  /** What Google Maps searches for. Name + town lets Google find the shop's own listing. */
  mapQuery: string;
  /** Street View at the shop, or null where Google has none (Nizwa, checked to ~45 m). */
  streetView: StreetView | null;
  /**
   * Footage filmed inside this showroom (an .mp4 address). None has been supplied yet, so
   * the "On display" tab plays clips of our own furniture and says so. Paste the address here.
   */
  video: string | null;
};

const SHOWROOMS: Record<string, Showroom> = {
  "al-hail-north": {
    week: week(LONG),
    mapQuery: "Muscat Furniture, Al Hail North, Muscat, Oman",
    // The pano here is a 360° tour inside the showroom ("Oman 360 Views"), not the street.
    streetView: { pin: [23.6420642, 58.2240124], heading: 0, inside: true },
    video: null,
  },
  sohar: {
    week: week(LONG),
    mapQuery: "Muscat Furniture, Sohar, Oman",
    streetView: { pin: [24.3549372, 56.7119534], heading: 255 },
    video: null,
  },
  barka: {
    week: week(SPLIT),
    mapQuery: "Muscat Furniture, Barka, Oman",
    streetView: { pin: [23.6716765, 57.8860203], heading: 0 },
    video: null,
  },
  "al-bidaya": {
    week: week(SPLIT),
    // Google finds the Al-Bidaya branch only by its Arabic name; the English searches return nothing.
    mapQuery: "مفروشات مسقط البداية",
    streetView: { pin: [23.91938, 57.1745642], heading: 0 },
    video: null,
  },
  nizwa: { week: week(LONG), mapQuery: "Muscat Furniture, Nizwa, Oman", streetView: null, video: null },
  salalah: {
    week: week(SPLIT),
    mapQuery: "Muscat Furniture, Salalah, Oman",
    streetView: { pin: [17.0222644, 54.1113219], heading: 80 },
    video: null,
  },
  "head-office": {
    week: null,
    // Google lists the office as "House # 800, 7014 Way, Muscat 121" -- the published address.
    mapQuery: "Muscat Furniture Azaiba North Muscat",
    streetView: { pin: [23.6028881, 58.3580932], heading: 0 },
    video: null,
  },
};

/** Extras for a store, falling back to a search on its address for a store added later. */
export function showroomFor(store: Store): Showroom {
  return (
    SHOWROOMS[store.slug] ?? { week: null, mapQuery: `Muscat Furniture, ${store.address}`, streetView: null, video: null }
  );
}

/** Keyless Street View embed, also allowed by frame-src in next.config.ts. */
export const streetViewUrl = ({ pin: [lat, lng], heading }: StreetView) =>
  `https://maps.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,${heading},0,0,0&output=svembed`;

/** Google's keyless embed. Allowed by frame-src in next.config.ts. */
export const mapEmbedUrl = (q: string) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
export const directionsUrl = (q: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Which store a label on the home-page map points at. The map's places are free text in the
 * back office ("Muscat · head office", "Al-Bidaya"), so match the label to a store slug
 * rather than adding a field the owner would have to keep in sync.
 */
export function storeForLabel(label: string, stores: Pick<Store, "slug">[]) {
  const s = slugify(label);
  return stores.find((st) => st.slug === s) ?? stores.find((st) => s.includes(st.slug)) ?? null;
}
