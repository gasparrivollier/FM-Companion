const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

/** White or near-black, whichever reads better on `hex` (prototype `inkOn`, lines 646-651). */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05) > (L + 0.05) / 0.056 ? "#ffffff" : "#0e1311";
}

/** Lightens a colour until it is readable as text on the dark background (prototype `liftOn`, lines 652-657). */
export function liftOn(hex: string): string {
  let c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const lum = (a: number[]) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  for (let k = 0; k < 14 && lum(c) < 0.22; k++) c = c.map((v) => Math.round(v + (255 - v) * 0.15));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
