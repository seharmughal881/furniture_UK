// What a mattress is made of, layer by layer, for the "Layers" view on mattress product pages.
//
// Built from the product NAME, which states the core (Bonnell / pocket springs, medical or HR foam),
// the top (Euro / pillow / velvet top), the comfort foam and the total thickness ("28CM"). The
// store's descriptions are not used for this: several are copied from other mattresses and
// contradict their own names. Only the total thickness is published, so each layer's share of it
// is an estimate and is shown as approximate.

export type LayerKind = "cover" | "top" | "comfort" | "bonnell" | "pocket" | "foamCore" | "base";
export type Layer = { kind: LayerKind; name: string; cm: number; about: string; colour: string };
export type MattressBuild = { totalCm: number | null; layers: Layer[] };

const COVER: Omit<Layer, "cm"> = {
  kind: "cover",
  name: "Quilted fabric cover",
  about: "Soft knitted fabric quilted to a thin foam, so the surface breathes and feels smooth.",
  colour: "#f4f2ee",
};

function topLayer(n: string): Omit<Layer, "cm"> | null {
  if (/euro ?top/.test(n))
    return { kind: "top", name: "Euro top", about: "A flat, extra-padded layer sewn flush on top for a plush hotel feel.", colour: "#ece6dc" };
  if (/velvet ?top/.test(n))
    return { kind: "top", name: "Velvet top", about: "A soft velvet-touch padded top layer.", colour: "#e6dccf" };
  if (/pillow/.test(n))
    return { kind: "top", name: "Pillow top", about: "A separately stitched cushion layer that softens pressure on hips and shoulders.", colour: "#f0ebe3" };
  return null;
}

function comfortLayer(n: string): Omit<Layer, "cm"> {
  if (/memory/.test(n))
    return { kind: "comfort", name: "Memory foam", about: "Slow-moving foam that moulds to your body and relieves pressure points.", colour: "#cfd8e3" };
  if (/hemp/.test(n))
    return { kind: "comfort", name: "Comfort foam with hemp oil", about: "A soft comfort foam layer, made with hemp oil as the name says.", colour: "#d9e2c4" };
  if (/high resilience|\bhr\b/.test(n))
    return { kind: "comfort", name: "High-resilience foam", about: "Springy, durable foam that bounces back quickly and keeps its shape.", colour: "#f1e6c8" };
  return { kind: "comfort", name: "Soft comfort foam", about: "A cushioning foam layer between the top and the support core.", colour: "#efe9dc" };
}

function core(n: string, description: string): Omit<Layer, "cm"> {
  // the name decides; the description is only a fallback for names with no keyword (e.g. "Jasper")
  const pick = (s: string) =>
    /pocket/.test(s) ? "pocket" : /bonn?ell?/.test(s) ? "bonnell" : /medical|orthopedic|orthopaedic/.test(s) ? "medical" : /high resilience|\bhr\b/.test(s) ? "hr" : null;
  const kind = pick(n) ?? pick(description.toLowerCase()) ?? "medical";
  if (kind === "pocket")
    return { kind: "pocket", name: "Pocket springs", about: "Each spring sits in its own fabric pocket and moves on its own, so a partner's movement isn't felt.", colour: "#d8d4cc" };
  if (kind === "bonnell")
    return { kind: "bonnell", name: "Bonnell springs", about: "Hourglass-shaped springs linked together into one unit — firm, even support with a classic bounce.", colour: "#9aa0a6" };
  if (kind === "hr")
    return { kind: "foamCore", name: "High-resilience foam core", about: "A thick block of springy, durable foam that supports the whole body.", colour: "#f3e7c4" };
  return { kind: "foamCore", name: "Bonded medical foam", about: "High-density bonded foam, firm for orthopedic back support.", colour: "#b7b2a8" };
}

const BASE: Omit<Layer, "cm"> = {
  kind: "base",
  name: "Firm base foam",
  about: "A dense foam layer under the springs that protects them and keeps the mattress stable.",
  colour: "#d6d0c4",
};

/** The layers of a mattress, top to bottom, with approximate thickness in cm. */
export function mattressLayers(name: string, description = ""): MattressBuild {
  const n = name.toLowerCase();
  const m = n.match(/(\d{2})\s*cm/);
  const totalCm = m ? Number(m[1]) : null;
  const total = totalCm ?? 25;

  const top = topLayer(n);
  const middle = core(n, description);
  const springs = middle.kind === "pocket" || middle.kind === "bonnell";
  const double = /double pillow/.test(n);

  const parts: { l: Omit<Layer, "cm">; cm: number }[] = [{ l: COVER, cm: 1.5 }];
  if (top) parts.push({ l: top, cm: top.kind === "top" && /pillow/.test(n) ? 5 : 4 });
  // an HR-foam core already is the named HR foam; the layer above it is plain comfort foam
  parts.push({ l: comfortLayer(middle.kind === "foamCore" ? n.replace(/high resilience|\bhr\b/g, "") : n), cm: 3 });
  parts.push({ l: middle, cm: 0 });
  if (springs) parts.push({ l: BASE, cm: 2 });
  if (double && top) parts.push({ l: { ...top, name: "Pillow top (underside)" }, cm: 5 });
  parts.push({ l: { ...COVER, name: "Quilted fabric cover (underside)" }, cm: 1.5 });

  // the core takes whatever the named total leaves
  const rest = parts.reduce((s, p) => s + p.cm, 0);
  parts.find((p) => p.l === middle)!.cm = Math.max(6, total - rest);
  return { totalCm, layers: parts.map((p) => ({ ...p.l, cm: Math.round(p.cm * 2) / 2 })) };
}
