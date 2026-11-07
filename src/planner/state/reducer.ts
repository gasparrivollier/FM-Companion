import { BAND, bandsOf, moveInBand, pickInto, removeInBand, type BandId } from "../domain/depth.ts";
import { COLS, VIEWS } from "../domain/columns.ts";
import type { OwnerData, Plan, Settings, Slot } from "../domain/ownerData.ts";
import type { Pos } from "../domain/positions.ts";
import { baseSeason } from "../domain/season.ts";
import { reconcile } from "../domain/reconcile.ts";
import type { Snapshot } from "../../shared/snapshot.ts";
import { buildPlayer, type Mark, type PlannerPlayer } from "../domain/squad.ts";
import { PRESETS, blankSlots, remap } from "../domain/tactics.ts";

export interface Club { id: number; nationOrdinal: number; name: string }

export interface PlannerState {
  data: OwnerData;
  players: PlannerPlayer[];
  gameDate: string;
  club: Club;
  /** uids that are in a plan but no longer in the snapshot */
  left: number[];
  /** first season shown (the year it ends) */
  base: number;
  /** selected season (the year it ends) */
  season: number;
  sel: number | null;
  view: number | null;
  band: BandId;
  bandMsg: string;
  posMsg: string;
  scope: "squad" | "xi";
  filter: string;
  q: string;
  sortKey: string;
  sortDir: 1 | -1;
  showAll: boolean;
}

export type Action =
  | { type: "setSeason"; season: number }
  | { type: "copyPlan" }
  | { type: "selectTactic"; id: string }
  | { type: "saveNewTactic"; name: string; id: string }
  | { type: "updateTactic" }
  | { type: "deleteTactic" }
  | { type: "moveSlot"; index: number; x: number; y: number }
  | { type: "selectSlot"; index: number | null }
  | { type: "pick"; uid: number; slotIndex?: number; band?: BandId }
  | { type: "moveInBand"; band: BandId; i: number; dir: 1 | -1 }
  | { type: "removeInBand"; band: BandId; i: number }
  | { type: "setRole"; role: string }
  | { type: "clearSlot" }
  | { type: "clearXI" }
  | { type: "cyclePos"; uid: number; code: Pos }
  | { type: "setPrimary"; uid: number; code: Pos }
  | { type: "removePlayer"; uid: number }
  | { type: "setView"; id: string }
  | { type: "toggleCol"; key: string }
  | { type: "saveView"; name: string; id: string }
  | { type: "deleteView" }
  | { type: "setSettings"; patch: Partial<Settings> }
  | { type: "toggleYouth" }
  | { type: "viewPlayer"; uid: number | null }
  | { type: "setBand"; band: BandId }
  | { type: "setScope"; scope: "squad" | "xi" }
  | { type: "setFilter"; filter: string }
  | { type: "setQuery"; q: string }
  | { type: "setSort"; key: string }
  | { type: "toggleShowAll" }
  | { type: "loadSnapshot"; snapshot: Snapshot };

export function initialState(data: OwnerData, players: PlannerPlayer[], gameDate: string, club: Club, left: number[]): PlannerState {
  const base = baseSeason(data, gameDate);
  return {
    data, players, gameDate, club, left, base, season: base, sel: null, view: null, band: "t", bandMsg: "", posMsg: "",
    scope: "squad", filter: "ALL", q: "", sortKey: "pos", sortDir: 1, showAll: false,
  };
}

const defaultPlan = (): Plan => ({ tacticId: "442", slots: blankSlots(PRESETS[0].slots), dirty: false });
const clonePlan = (p: Plan): Plan => ({ ...p, slots: p.slots.map((s) => ({ ...s, alt: s.alt.slice() })) });

export function activePlan(s: PlannerState): Plan {
  return s.data.plans[s.season] ?? defaultPlan();
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DEF_SORT_DIR: Record<string, 1 | -1> = { xi: 1, name: 1, pos: 1, cub: -1, age: 1, wage: -1, rating: -1, exp: 1, role: 1 };

function withPlan(s: PlannerState, plan: Plan, extra: Partial<PlannerState> = {}): PlannerState {
  return { ...s, ...extra, data: { ...s.data, plans: { ...s.data.plans, [s.season]: plan } } };
}
function editSlots(s: PlannerState, slots: Slot[], extra: Partial<PlannerState> = {}): PlannerState {
  return withPlan(s, { ...activePlan(s), slots, dirty: true }, extra);
}
function withMark(s: PlannerState, uid: number, mark: Mark, extra: Partial<PlannerState> = {}): PlannerState {
  const marks = { ...s.data.marks, [uid]: mark };
  const players = s.players.map((p) => (p.uid === uid ? buildPlayer(p.snap, p.squad, mark) : p));
  return { ...s, ...extra, players, data: { ...s.data, marks } };
}
const playerOf = (s: PlannerState, uid: number) => s.players.find((p) => p.uid === uid);

export function reduce(s: PlannerState, a: Action): PlannerState {
  switch (a.type) {
    case "setSeason": {
      if (a.season === s.season) return s;
      const plans = { ...s.data.plans };
      if (!plans[s.season]) plans[s.season] = defaultPlan();
      if (!plans[a.season]) plans[a.season] = clonePlan(plans[s.season]);
      return { ...s, season: a.season, sel: null, view: null, bandMsg: "", data: { ...s.data, plans } };
    }
    case "copyPlan": {
      if (s.season === s.base) return s;
      const src = s.data.plans[s.base] ?? defaultPlan();
      return withPlan(s, clonePlan(src), { sel: null });
    }
    case "selectTactic": {
      const cur = activePlan(s);
      const pre = PRESETS.find((t) => t.id === a.id);
      if (pre) return withPlan(s, { tacticId: a.id, slots: remap(cur.slots, pre.slots), dirty: false }, { sel: null });
      const c = s.data.custom.find((t) => t.id === a.id);
      if (!c) return s;
      return withPlan(s, { tacticId: a.id, slots: c.slots.map((x) => ({ ...x, alt: x.alt.slice() })), dirty: false }, { sel: null });
    }
    case "saveNewTactic": {
      const name = a.name.trim().slice(0, 32) || `Táctica ${s.data.custom.length + 1}`;
      const cur = activePlan(s);
      const custom = [...s.data.custom, { id: a.id, name, slots: clonePlan(cur).slots }];
      const next = withPlan(s, { ...cur, tacticId: a.id, dirty: false });
      return { ...next, data: { ...next.data, custom } };
    }
    case "updateTactic": {
      const cur = activePlan(s);
      if (!s.data.custom.some((c) => c.id === cur.tacticId)) return s;
      const custom = s.data.custom.map((c) => (c.id === cur.tacticId ? { ...c, slots: clonePlan(cur).slots } : c));
      const next = withPlan(s, { ...cur, dirty: false });
      return { ...next, data: { ...next.data, custom } };
    }
    case "deleteTactic": {
      const cur = activePlan(s);
      const custom = s.data.custom.filter((c) => c.id !== cur.tacticId);
      const next = withPlan(s, { tacticId: "442", slots: remap(cur.slots, PRESETS[0].slots), dirty: false }, { sel: null });
      return { ...next, data: { ...next.data, custom } };
    }
    case "moveSlot": {
      const slots = activePlan(s).slots.map((x, k) =>
        k === a.index ? { ...x, x: Math.round(clamp(a.x, 6, 94) * 10) / 10, y: Math.round(clamp(a.y, 5, 96) * 10) / 10 } : x,
      );
      return editSlots(s, slots);
    }
    case "selectSlot": {
      if (a.index === null) return { ...s, sel: null };
      const slot = activePlan(s).slots[a.index];
      return { ...s, sel: a.index, view: slot?.uid ?? s.view, showAll: false, band: "t", bandMsg: "" };
    }
    case "pick": {
      if (s.left.includes(a.uid)) return s;
      const i = a.slotIndex ?? s.sel;
      if (i === null || i === undefined) return s;
      const bnd: BandId = a.slotIndex !== undefined ? "t" : a.band ?? s.band;
      const plan = activePlan(s);
      const r = pickInto(plan.slots, i, a.uid, bnd);
      if (r.message) return { ...s, bandMsg: r.message };
      if (r.slots === plan.slots) return s;
      let sel = s.sel;
      let band = s.band;
      if (a.slotIndex === undefined && a.band === undefined) {
        if (bnd === "t") {
          sel = null;
          band = "t";
          for (let k = 1; k < r.slots.length; k++) {
            const j = (i + k) % r.slots.length;
            if (r.slots[j].uid === null) { sel = j; break; }
          }
        } else if (bandsOf(r.slots[i])[bnd].length >= BAND[bnd].max) {
          band = bnd === "s" ? "r" : bnd === "r" ? "o" : bnd;
        }
      }
      const next = editSlots(s, r.slots, { sel, band, bandMsg: "", view: a.uid, showAll: false });
      const who = playerOf(s, a.uid);
      // remember the name: if he later leaves the squad the plan can still show who he was
      return who ? { ...next, data: { ...next.data, known: { ...next.data.known, [a.uid]: { name: who.name } } } } : next;
    }
    case "moveInBand": {
      if (s.sel === null || a.band === "t") return s;
      const slots = activePlan(s).slots.map((x, k) => (k === s.sel ? moveInBand(x, a.band, a.i, a.dir) : x));
      return editSlots(s, slots);
    }
    case "removeInBand": {
      if (s.sel === null) return s;
      const slots = activePlan(s).slots.map((x, k) => (k === s.sel ? removeInBand(x, a.band, a.i) : x));
      return editSlots(s, slots, { bandMsg: "" });
    }
    case "setRole": {
      if (s.sel === null) return s;
      const slots = activePlan(s).slots.map((x, k) => (k === s.sel ? { ...x, role: x.role === a.role ? null : a.role } : x));
      return editSlots(s, slots);
    }
    case "clearSlot": {
      if (s.sel === null) return s;
      const slots = activePlan(s).slots.map((x, k) => (k === s.sel ? { ...x, uid: null, role: null, alt: [] } : x));
      return editSlots(s, slots);
    }
    case "clearXI":
      return editSlots(s, activePlan(s).slots.map((x) => ({ ...x, uid: null })));
    case "cyclePos": {
      const p = playerOf(s, a.uid);
      if (!p) return s;
      let natural = p.natural.slice();
      let covers = p.covers.slice();
      if (natural.includes(a.code)) {
        if (natural.length === 1) return { ...s, posMsg: "Dejá al menos una posición natural: primero marcá otra como natural." };
        natural = natural.filter((x) => x !== a.code);
        covers = [...covers, a.code];
      } else if (covers.includes(a.code)) {
        covers = covers.filter((x) => x !== a.code);
      } else {
        natural = [...natural, a.code];
      }
      return withMark(s, a.uid, { natural, covers, ...(p.hidden ? { hidden: true } : {}) }, { posMsg: "" });
    }
    case "setPrimary": {
      const p = playerOf(s, a.uid);
      if (!p || !p.natural.includes(a.code)) return s;
      return withMark(s, a.uid, {
        natural: [a.code, ...p.natural.filter((x) => x !== a.code)], covers: p.covers, ...(p.hidden ? { hidden: true } : {}),
      });
    }
    case "removePlayer": {
      const p = playerOf(s, a.uid);
      if (!p) return s;
      const slots = activePlan(s).slots.map((x) => ({ ...x, uid: x.uid === a.uid ? null : x.uid, alt: x.alt.map((u) => (u === a.uid ? null : u)) }));
      const next = withMark(s, a.uid, { natural: p.natural, covers: p.covers, hidden: true }, { view: null });
      return editSlots(next, slots);
    }
    case "setView": {
      const v = [...VIEWS, ...s.data.views].find((x) => x.id === a.id);
      return v ? { ...s, data: { ...s.data, cols: v.cols.slice(), viewId: a.id } } : s;
    }
    case "toggleCol": {
      const has = s.data.cols.includes(a.key);
      if (has && s.data.cols.length === 1) return s;
      const cols = COLS.map((c) => c.k).filter((k) => k !== "name" && (k === a.key ? !has : s.data.cols.includes(k)));
      return { ...s, data: { ...s.data, cols, viewId: null } };
    }
    case "saveView": {
      const name = a.name.trim() || `Vista ${s.data.views.length + 1}`;
      return { ...s, data: { ...s.data, views: [...s.data.views, { id: a.id, name, cols: s.data.cols.slice() }], viewId: a.id } };
    }
    case "deleteView":
      return { ...s, data: { ...s.data, views: s.data.views.filter((v) => v.id !== s.data.viewId), cols: VIEWS[0].cols.slice(), viewId: "basica" } };
    case "setSettings": {
      const next = { ...s, data: { ...s.data, settings: { ...s.data.settings, ...a.patch } } };
      if (!("seasonEndOverride" in a.patch)) return next;
      const base = baseSeason(next.data, s.gameDate);
      return { ...next, base, season: s.season >= base && s.season <= base + 2 ? s.season : base, sel: null };
    }
    case "toggleYouth":
      return { ...s, data: { ...s.data, includeYouth: !s.data.includeYouth } };
    case "viewPlayer": return { ...s, view: a.uid };
    case "setBand": return { ...s, band: a.band, bandMsg: "" };
    case "setScope": return { ...s, scope: a.scope };
    case "setFilter": return { ...s, filter: a.filter };
    case "setQuery": return { ...s, q: a.q };
    case "setSort":
      return s.sortKey === a.key ? { ...s, sortDir: (-s.sortDir) as 1 | -1 } : { ...s, sortKey: a.key, sortDir: DEF_SORT_DIR[a.key] ?? 1 };
    case "toggleShowAll": return { ...s, showAll: !s.showAll };
    case "loadSnapshot": {
      const r = reconcile(s.data, a.snapshot);
      const gameDate = a.snapshot.meta.gameDate;
      const c = a.snapshot.meta.club;
      const base = baseSeason(r.data, gameDate);
      const season = s.season >= base && s.season <= base + 2 ? s.season : base;
      return {
        ...s, data: r.data, players: r.players, left: r.left, gameDate, base, season, sel: null, view: null, bandMsg: "",
        club: { id: c.id, nationOrdinal: c.nationOrdinal, name: c.name },
      };
    }
  }
}

/** True when the player is in a plan but no longer in the squad. */
export function isLeft(s: PlannerState, uid: number): boolean {
  return s.left.includes(uid);
}
