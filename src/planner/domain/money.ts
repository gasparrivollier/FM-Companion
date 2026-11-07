import type { Settings } from "./ownerData.ts";

const SYMBOL = { GBP: "£", USD: "$", EUR: "€" } as const;

/** Wages are stored in pounds per week; shown in the chosen currency (prototype `money`, lines 1162-1167). */
export function money(gbp: number, s: Pick<Settings, "currency" | "usdPerGbp" | "eurPerGbp">): string {
  const rate = s.currency === "USD" ? s.usdPerGbp : s.currency === "EUR" ? s.eurPerGbp : 1;
  const n = Math.round((gbp || 0) * rate);
  const cur = SYMBOL[s.currency];
  if (n >= 1e6) return cur + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "").replace(".", ",") + "M";
  if (n >= 1e3) return cur + Math.round(n / 1e3) + "K";
  return cur + n;
}
