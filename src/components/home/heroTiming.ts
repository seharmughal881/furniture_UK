/** Scroll-position maths shared by HeroStory and its 3D scene. Deliberately three-free. */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const A_END = 0.3; // assembly
export const B_END = 0.56; // material lab
export const hourAt = (p: number) => 13 + 9 * smooth(0.62, 0.97, p);
