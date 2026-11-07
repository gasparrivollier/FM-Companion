import type { Slot } from "./ownerData.ts";

export type BandId = "t" | "s" | "r" | "o";
export const BAND: Record<BandId, { title: string; word: string; max: number }> = {
  t: { title: "Titular", word: "titular", max: 1 },
  s: { title: "Suplentes", word: "suplente", max: 2 },
  r: { title: "Recambios / juveniles", word: "recambio/juvenil", max: 3 },
  o: { title: "Otros", word: "otro", max: 99 },
};
export const BANDS: BandId[] = ["t", "s", "r", "o"];

export interface Bands { t: number | null; s: number[]; r: number[]; o: number[] }

// alt = [suplente, suplente, recambio, recambio, recambio, otros...] (prototype lines 614-635, with fixed band sizes)
function normAlt(a: (number | null)[]): (number | null)[] {
  const out = a.slice();
  for (let k = out.length - 1; k >= 5; k--) if (!out[k]) out.splice(k, 1);
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
const isId = (x: number | null): x is number => x !== null && x !== undefined;

export function bandsOf(s: Slot): Bands {
  const d = [s.uid, ...s.alt];
  while (d.length < 6) d.push(null);
  return { t: d[0] ?? null, s: d.slice(1, 3).filter(isId), r: d.slice(3, 6).filter(isId), o: d.slice(6).filter(isId) };
}

export function withBands(slot: Slot, b: Bands): Slot {
  const pad = (a: number[], n: number): (number | null)[] => { const x: (number | null)[] = a.slice(0, n); while (x.length < n) x.push(null); return x; };
  return { ...slot, uid: b.t ?? null, alt: normAlt([...pad(b.s, 2), ...pad(b.r, 3), ...b.o]) };
}

/** Puts `uid` into `band` of the slot at `slotIndex` (prototype `pick`, lines 973-1014, without the cursor logic). */
export function pickInto(slots: Slot[], slotIndex: number, uid: number, band: BandId): { slots: Slot[]; message: string | null } {
  const next = slots.map((s) => ({ ...s, alt: s.alt.slice() }));
  const b = bandsOf(next[slotIndex]);
  const where: BandId | null = b.t === uid ? "t" : (["s", "r", "o"] as const).find((k) => b[k].includes(uid)) ?? null;
  if (where === band) return { slots, message: null };
  if (band !== "t" && b[band].length >= BAND[band].max) {
    return { slots, message: `${BAND[band].title}: franja completa (${BAND[band].max}/${BAND[band].max}). Quitá a alguien primero.` };
  }
  if (band === "t") {
    const old = b.t;
    const from = next.findIndex((q, k) => k !== slotIndex && q.uid === uid);
    if (from >= 0) next[from].uid = old;
    if (where && where !== "t") {
      const ix = b[where].indexOf(uid);
      b[where].splice(ix, 1);
      if (old !== null) b[where].splice(ix, 0, old);
    }
    b.t = uid;
  } else {
    if (where === "t") b.t = null;
    else if (where) b[where] = b[where].filter((x) => x !== uid);
    b[band].push(uid);
  }
  next[slotIndex] = withBands(next[slotIndex], b);
  return { slots: next, message: null };
}

export function moveInBand(slot: Slot, band: BandId, i: number, dir: 1 | -1): Slot {
  if (band === "t") return slot;
  const b = bandsOf(slot);
  const a = b[band];
  const j = i + dir;
  if (j < 0 || j >= a.length || i < 0 || i >= a.length) return slot;
  [a[i], a[j]] = [a[j], a[i]];
  return withBands(slot, b);
}

export function removeInBand(slot: Slot, band: BandId, i: number): Slot {
  const b = bandsOf(slot);
  if (band === "t") b.t = null;
  else b[band].splice(i, 1);
  return withBands(slot, b);
}
