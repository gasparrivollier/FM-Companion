import type { Slot } from "./ownerData.ts";
import { GROUP, VAR, type Pos } from "./positions.ts";

type Pt = [Pos, number, number];
export interface Formation { id: string; name: string; slots: Slot[] }

function F(id: string, name: string, pts: Pt[]): Formation {
  return { id, name, slots: pts.map(([code, x, y]) => ({ code, x, y, uid: null, role: null, alt: [] })) };
}
const BACK4: Pt[] = [["POR", 50, 91], ["DFI", 14, 73], ["DFC", 38, 76], ["DFC", 62, 76], ["DFD", 86, 73]];

// The eight presets of the prototype (lines 584-594).
export const PRESETS: Formation[] = [
  F("442", "4-4-2", BACK4.concat([["MEI", 14, 50], ["MEC", 38, 53], ["MEC", 62, 53], ["MED", 86, 50], ["DLC", 38, 24], ["DLC", 62, 24]] as Pt[])),
  F("4231", "4-2-3-1", BACK4.concat([["MC", 36, 60], ["MC", 64, 60], ["MPI", 16, 40], ["MPC", 50, 40], ["MPD", 84, 40], ["DLC", 50, 19]] as Pt[])),
  F("433", "4-3-3", BACK4.concat([["MC", 50, 61], ["MEC", 30, 48], ["MEC", 70, 48], ["MPI", 17, 26], ["DLC", 50, 19], ["MPD", 83, 26]] as Pt[])),
  F("4141", "4-1-4-1", BACK4.concat([["MC", 50, 62], ["MEI", 14, 46], ["MEC", 38, 48], ["MEC", 62, 48], ["MED", 86, 46], ["DLC", 50, 19]] as Pt[])),
  F("41212", "4-1-2-1-2", BACK4.concat([["MC", 50, 63], ["MEC", 30, 50], ["MEC", 70, 50], ["MPC", 50, 37], ["DLC", 38, 20], ["DLC", 62, 20]] as Pt[])),
  F("352", "3-5-2", [["POR", 50, 91], ["DFC", 24, 76], ["DFC", 50, 78], ["DFC", 76, 76], ["CRI", 10, 56], ["CRD", 90, 56], ["MC", 50, 62], ["MEC", 30, 47], ["MEC", 70, 47], ["DLC", 38, 21], ["DLC", 62, 21]]),
  F("343", "3-4-3", [["POR", 50, 91], ["DFC", 24, 76], ["DFC", 50, 78], ["DFC", 76, 76], ["CRI", 10, 54], ["MEC", 38, 52], ["MEC", 62, 52], ["CRD", 90, 54], ["MPI", 17, 26], ["DLC", 50, 19], ["MPD", 83, 26]]),
  F("532", "5-3-2", [["POR", 50, 91], ["CRI", 9, 62], ["DFC", 29, 77], ["DFC", 50, 79], ["DFC", 71, 77], ["CRD", 91, 62], ["MEC", 30, 47], ["MC", 50, 57], ["MEC", 70, 47], ["DLC", 38, 22], ["DLC", 62, 22]]),
];

/** Same shape, nobody assigned. */
export function blankSlots(tpl: Slot[]): Slot[] {
  return tpl.map((t) => ({ code: t.code, x: t.x, y: t.y, uid: null, role: null, alt: [] }));
}

/** "DFCI / DFCD" when two or more slots share a base position (prototype lines 664-677). */
export function slotLabels(slots: Slot[]): string[] {
  return slots.map((s, i) => {
    const v = VAR[s.code];
    if (!v) return s.code;
    const same = slots.map((t, k) => ({ k, x: t.x, code: t.code })).filter((o) => o.code === s.code).sort((a, b) => a.x - b.x);
    if (same.length < 2) return s.code;
    const r = same.findIndex((o) => o.k === i);
    return r === 0 ? v[0] : r === same.length - 1 ? v[2] : v[1];
  });
}

/**
 * Moves the players of `oldSlots` into the template `tpl` (prototype lines 697-710): same position first, keeping role and
 * depth, then any remaining player of the same group. Slots nobody fits stay empty (no auto-fill).
 */
export function remap(oldSlots: Slot[], tpl: Slot[]): Slot[] {
  const pool = oldSlots
    .filter((s) => s.uid !== null || s.role || s.alt.length)
    .map((s) => ({ uid: s.uid, code: s.code, role: s.role, alt: s.alt.slice() }));
  const slots: Slot[] = blankSlots(tpl);
  const pass = (test: (p: (typeof pool)[number], s: Slot) => boolean, withRole: boolean) => {
    for (const s of slots) {
      if (s.uid !== null || s.role || s.alt.length) continue;
      const i = pool.findIndex((p) => test(p, s));
      if (i < 0) continue;
      s.uid = pool[i].uid;
      if (withRole) { s.role = pool[i].role; s.alt = pool[i].alt; }
      pool.splice(i, 1);
    }
  };
  pass((p, s) => p.code === s.code, true);
  pass((p, s) => p.uid !== null && GROUP[p.code] === GROUP[s.code], false);
  return slots;
}
