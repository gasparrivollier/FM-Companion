import { money } from "./money.ts";
import { GLIST, GROUP } from "./positions.ts";
import { ageAt, expiryWarn, expiryYear } from "./season.ts";
import type { PlannerPlayer } from "./squad.ts";
import { activePlan, type PlannerState } from "../state/reducer.ts";

export interface RowModel {
  uid: number; name: string; slot: number | null; age: number; wage: string; wageGbp: number; ca: number;
  exp: string; expWarn: boolean; role: string;
}

function slotMap(s: PlannerState): Map<number, number> {
  const m = new Map<number, number>();
  activePlan(s).slots.forEach((x, i) => { if (x.uid !== null) m.set(x.uid, i); });
  return m;
}

export function rowModel(s: PlannerState, p: PlannerPlayer): RowModel {
  const slot = slotMap(s).get(p.uid) ?? null;
  const end = p.contract?.end ?? null;
  const year = expiryYear(end);
  return {
    uid: p.uid, name: p.name, slot,
    age: ageAt(p.birthDate, s.gameDate, s.season - s.base),
    wageGbp: p.contract?.wageGbpWeek ?? 0,
    wage: money(p.contract?.wageGbpWeek ?? 0, s.data.settings),
    ca: p.ca,
    exp: year === null ? "–" : String(year),
    expWarn: expiryWarn(end, s.season),
    role: slot !== null ? activePlan(s).slots[slot].role ?? "" : "",
  };
}

/** The rows of the squad table: search, group filter and sort (prototype lines 1230-1247). */
export function visibleRows(s: PlannerState): PlannerPlayer[] {
  const slots = slotMap(s);
  const q = s.q.trim().toLowerCase();
  let list = s.players.filter((p) => !p.hidden && (s.data.includeYouth || p.squad === "first"));
  list = list.filter((p) => s.filter === "ALL" || (p.natural.length > 0 && GROUP[p.natural[0]] === s.filter));
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.natural.join(" ").toLowerCase().includes(q));
  const rows = new Map(list.map((p) => [p.uid, rowModel(s, p)]));
  const dir = s.sortDir;
  const key = s.sortKey;
  return list.slice().sort((a, b) => {
    const ra = rows.get(a.uid)!;
    const rb = rows.get(b.uid)!;
    switch (key) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "pos": {
        const x = GLIST.indexOf(GROUP[a.natural[0]]);
        const y = GLIST.indexOf(GROUP[b.natural[0]]);
        return x !== y ? dir * (x - y) : b.ca - a.ca;
      }
      case "xi": return dir * ((slots.get(a.uid) ?? 99) - (slots.get(b.uid) ?? 99));
      case "cub": return dir * (a.covers.length - b.covers.length);
      case "role": return dir * ra.role.localeCompare(rb.role);
      case "age": return dir * (ra.age - rb.age);
      case "wage": return dir * (ra.wageGbp - rb.wageGbp);
      case "rating": return dir * (a.ca - b.ca);
      case "exp": return dir * ((expiryYear(a.contract?.end ?? null) ?? 9999) - (expiryYear(b.contract?.end ?? null) ?? 9999));
      default: return 0;
    }
  });
}
