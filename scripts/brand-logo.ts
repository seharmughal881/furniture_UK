// Builds the site's logo files from Muscat Furniture's official artwork.
//
//   npm run brand:logo                     # from the saved copy in data/brand
//   npm run brand:logo -- --fetch          # download the current one from the shop first
//
// The official logo is one stacked PNG: a red-and-black sofa over "MUSCAT" over
// "FURNITURE", on transparency. Two things stop it being dropped into the page as-is.
//
// 1. It is black. Our header is near-black, so the frame, the legs and the whole word
//    "MUSCAT" disappear into it. Brands normally ship a reversed version for dark
//    backgrounds; Muscat Furniture does not, so one is made here -- black becomes the
//    header's cream, the red is left exactly as it is, and nothing else changes.
//
// 2. It is stacked, nearly as tall as it is wide. In a 60px header the word
//    "FURNITURE" would come out about five pixels tall, which is a smudge rather than a
//    word. So the sofa alone is also cut out, for the header to use beside the name set
//    in the site's own type. The full logo goes where there is room for it.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE = "https://muscatfurniture.com/cdn/shop/files/MUSCAT_LOGO_PNG.png?v=1723727774";
const DATA = join(__dirname, "..", "data", "brand");
const OUT = join(__dirname, "..", "public", "brand");
/* Next.js serves src/app/icon.png as the tab icon by file convention. */
const APP = join(__dirname, "..", "src", "app");
const ORIGINAL = join(DATA, "muscat-logo-original.png");

/** The header's text colour, so the reversed logo matches the words beside it. */
const CREAM = { r: 0xf2, g: 0xec, b: 0xe2 };
/** A pixel this dark is logo black, not logo red: the red is #b72025, whose red channel is 183. */
const DARK = 90;

/**
 * The sofa, without the two swooshes under it.
 *
 * Measured from the artwork rather than guessed: the swooshes run the full width of the
 * canvas, so including them gives a mark five times wider than it is tall, which cannot
 * sit next to the shop name.
 *
 * It keeps the swooshes but cuts them at the sides. Cutting them off below the sofa
 * instead is not possible: the red swoosh starts at y=1466 while the sofa's feet run on
 * to y=1600, so the two overlap and any horizontal cut either slices the feet off or
 * leaves a red smear under them -- both of which this did before being measured.
 * Trimming the full-width swooshes to the sofa's own width keeps the curve the logo is
 * known for and gives a 1.83:1 mark that sits beside the shop name.
 */
const SOFA = { left: 700, top: 0, width: 3400, height: 1860 };

/** Repaints the black parts cream and leaves everything else alone. */
async function reversed(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 10) continue; // transparent: nothing to repaint
    if (data[i] < DARK && data[i + 1] < DARK && data[i + 2] < DARK) {
      data[i] = CREAM.r;
      data[i + 1] = CREAM.g;
      data[i + 2] = CREAM.b;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  if (process.argv.includes("--fetch") || !existsSync(ORIGINAL)) {
    const res = await fetch(SOURCE, { headers: { "User-Agent": "Mozilla/5.0 (brand assets)" } });
    if (!res.ok) throw new Error(`${res.status} fetching the logo`);
    await writeFile(ORIGINAL, Buffer.from(await res.arrayBuffer()));
    console.log(`Downloaded the official logo to ${ORIGINAL}`);
  }

  const full = await sharp(ORIGINAL).trim().png().toBuffer();
  const mark = await sharp(ORIGINAL).extract(SOFA).trim().png().toBuffer();

  // Written at twice their display size so they stay sharp on a retina screen.
  const files: [string, Buffer, number][] = [
    ["muscat-logo.png", full, 560],
    ["muscat-logo-light.png", await reversed(full), 560],
    ["muscat-mark.png", mark, 200],
    ["muscat-mark-light.png", await reversed(mark), 200],
  ];

  for (const [name, buf, width] of files) {
    const out = await sharp(buf).resize({ width }).png({ compressionLevel: 9, palette: true }).toBuffer();
    await writeFile(join(OUT, name), out);
    const m = await sharp(out).metadata();
    console.log(`  public/brand/${name.padEnd(24)} ${m.width}x${m.height}  ${(out.length / 1024).toFixed(1)} kB`);
  }

  /*
   * The browser tab icon: the sofa on the brand's dark background.
   *
   * It is flattened onto a colour rather than left transparent because a tab strip can
   * be light or dark depending on the visitor's own theme, and the artwork is only
   * legible against one of those. Giving it its own background means the mark looks the
   * same in either. The reversed artwork is the one that suits that dark square.
   */
  const ICON = 512;
  const inset = Math.round(ICON * 0.16);
  const icon = await sharp({
    create: { width: ICON, height: ICON, channels: 4, background: "#141112" },
  })
    .composite([{ input: await sharp(await reversed(mark)).resize({ width: ICON - inset * 2 }).toBuffer() }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(APP, "icon.png"), icon);
  console.log(`  src/app/icon.png${" ".repeat(13)} ${ICON}x${ICON}  ${(icon.length / 1024).toFixed(1)} kB`);

  /*
   * favicon.ico as well, not just icon.png.
   *
   * Next.js emits a link for each, and which one a browser picks is its own business --
   * some still ask for /favicon.ico by name. Leaving the old hand-drawn one in place
   * would mean the tab sometimes showed the previous mark. sharp cannot write .ico, but
   * an .ico is allowed to be a container around a PNG, which is 22 bytes of header.
   */
  const inner = await sharp(icon).resize({ width: 256, height: 256 }).png({ compressionLevel: 9 }).toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(1, 4); // one image in the file
  header.writeUInt8(0, 6); // width, 0 meaning 256
  header.writeUInt8(0, 7); // height, likewise
  header.writeUInt8(0, 8); // palette size: not paletted
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(inner.length, 14);
  header.writeUInt32LE(header.length, 18); // the image starts right after this header
  const ico = Buffer.concat([header, inner]);
  await writeFile(join(APP, "favicon.ico"), ico);
  console.log(`  src/app/favicon.ico${" ".repeat(10)} 256x256  ${(ico.length / 1024).toFixed(1)} kB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
