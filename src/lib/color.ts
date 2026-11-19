/**
 * A four-method stand-in for THREE.Color, so that code which only mixes two hex colours
 * does not have to import three.js.
 *
 * HeroStory tints the page background as the visitor scrolls. It used THREE.Color for
 * copy/lerp/getHexString, and that single `import * as THREE` put the whole ~891 KB engine
 * into the home page's bundle even though the tint is CSS and runs on desktop only.
 *
 * Mixing happens in linear space, not on the sRGB values, because that is what three does
 * (ColorManagement has been on by default since r152) and the midpoints of a gradient
 * would visibly shift if this blended the raw bytes instead.
 */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const byte = (c: number) =>
  Math.round(clamp(toSrgb(c)) * 255)
    .toString(16)
    .padStart(2, "0");

export class Color {
  r = 0;
  g = 0;
  b = 0;

  constructor(hex?: string) {
    if (hex) this.set(hex);
  }

  /** Accepts "#rgb" and "#rrggbb"; anything else leaves the colour untouched. */
  set(hex: string): this {
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return this;
    const n = Number.parseInt(h, 16);
    if (Number.isNaN(n)) return this;
    this.r = toLinear(((n >> 16) & 255) / 255);
    this.g = toLinear(((n >> 8) & 255) / 255);
    this.b = toLinear((n & 255) / 255);
    return this;
  }

  copy(c: Color): this {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }

  lerp(c: Color, t: number): this {
    const k = clamp(t);
    this.r += (c.r - this.r) * k;
    this.g += (c.g - this.g) * k;
    this.b += (c.b - this.b) * k;
    return this;
  }

  /** Without the leading "#", matching THREE.Color.getHexString(). */
  getHexString(): string {
    return `${byte(this.r)}${byte(this.g)}${byte(this.b)}`;
  }
}
