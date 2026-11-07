import { GROUP, type Pos } from "./positions.ts";
import type { Mark } from "./squad.ts";

export const OWNER_VERSION = 1;
export type CurrencyCode = "GBP" | "USD" | "EUR";

export interface Slot { code: Pos; x: number; y: number; uid: number | null; role: string | null; alt: (number | null)[] }
export interface Plan { tacticId: string; slots: Slot[]; dirty: boolean }
export interface CustomTactic { id: string; name: string; slots: Slot[] }
export interface SavedView { id: string; name: string; cols: string[] }

export interface Settings {
  team: string; c1: string; c2: string; currency: CurrencyCode; usdPerGbp: number; eurPerGbp: number; seasonEndOverride: number | null;
}
export interface OwnerData {
  version: 1;
  settings: Settings;
  marks: Record<number, Mark>;
  plans: Record<number, Plan>;
  custom: CustomTactic[];
  views: SavedView[];
  cols: string[];
  viewId: string | null;
  includeYouth: boolean;
  known: Record<number, { name: string }>;
  lastSeason: number | null;
}

/** Selectable columns (the name column is always shown). */
export const COL_KEYS = ["xi", "pos", "cub", "age", "wage", "rating", "exp", "role"] as const;
export const DEFAULT_COLS = ["xi", "pos", "age", "wage", "rating", "exp"];

export function defaultOwnerData(): OwnerData {
  return {
    version: OWNER_VERSION,
    settings: { team: "Mi equipo", c1: "#0b5d3b", c2: "#f2b84b", currency: "USD", usdPerGbp: 1.2492, eurPerGbp: 1.17, seasonEndOverride: null },
    marks: {}, plans: {}, custom: [], views: [], cols: DEFAULT_COLS.slice(), viewId: "basica", includeYouth: false, known: {}, lastSeason: null,
  };
}

export type ParseResult =
  | { ok: true; data: OwnerData }
  | { ok: false; reason: "invalid" | "newer"; message: string };

const isObj = (x: unknown): x is Record<string, any> => typeof x === "object" && x !== null && !Array.isArray(x);
const isPos = (x: unknown): x is Pos => typeof x === "string" && x in GROUP;
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const uidOrNull = (x: unknown): number | null => (num(x) ? x : null);

function cleanSlots(a: unknown): Slot[] | null {
  if (!Array.isArray(a)) return null;
  const out = a
    .filter((s) => isObj(s) && isPos(s.code) && num(s.x) && num(s.y))
    .map((s) => ({
      code: s.code as Pos, x: s.x as number, y: s.y as number, uid: uidOrNull(s.uid),
      role: typeof s.role === "string" && s.role ? s.role : null,
      alt: Array.isArray(s.alt) ? (s.alt as unknown[]).map(uidOrNull) : [],
    }));
  return out.length === 11 ? out : null;
}
function cleanCols(a: unknown): string[] {
  const out = Array.isArray(a) ? COL_KEYS.filter((k) => (a as unknown[]).includes(k)) : [];
  return out.length ? out : DEFAULT_COLS.slice();
}
const colour = (v: unknown, f: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : f);
const rate = (v: unknown, f: number) => (num(v) && v > 0 ? v : f);

export function parseOwnerData(text: string): ParseResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: "invalid", message: "El archivo de datos propios no se puede leer (JSON inválido)." }; }
  if (!isObj(raw)) return { ok: false, reason: "invalid", message: "El archivo de datos propios no tiene el formato esperado." };
  if (!num(raw.version)) return { ok: false, reason: "invalid", message: "El archivo de datos propios no declara su versión; no se carga para no pisarlo." };
  if (raw.version > OWNER_VERSION) {
    return { ok: false, reason: "newer", message: `Los datos propios son de una versión más nueva de la app (versión ${raw.version}; esta app entiende hasta la ${OWNER_VERSION}).` };
  }
  if (raw.version !== OWNER_VERSION) return { ok: false, reason: "invalid", message: `Versión ${raw.version} de los datos propios no reconocida.` };
  const d = defaultOwnerData();
  const s = isObj(raw.settings) ? raw.settings : {};
  d.settings = {
    team: typeof s.team === "string" ? s.team : d.settings.team,
    c1: colour(s.c1, d.settings.c1), c2: colour(s.c2, d.settings.c2),
    currency: s.currency === "GBP" || s.currency === "USD" || s.currency === "EUR" ? s.currency : d.settings.currency,
    usdPerGbp: rate(s.usdPerGbp, d.settings.usdPerGbp), eurPerGbp: rate(s.eurPerGbp, d.settings.eurPerGbp),
    seasonEndOverride: num(s.seasonEndOverride) && s.seasonEndOverride >= 2000 && s.seasonEndOverride <= 2100 ? s.seasonEndOverride : null,
  };
  if (isObj(raw.marks)) {
    for (const [k, m] of Object.entries(raw.marks)) {
      if (!isObj(m) || !Array.isArray(m.natural) || !Array.isArray(m.covers)) continue;
      const mark: Mark = { natural: m.natural.filter(isPos), covers: m.covers.filter(isPos) };
      if (m.hidden === true) mark.hidden = true;
      if (mark.natural.length || mark.hidden) d.marks[Number(k)] = mark;
    }
  }
  if (isObj(raw.plans)) {
    for (const [k, p] of Object.entries(raw.plans)) {
      const slots = isObj(p) ? cleanSlots(p.slots) : null;
      if (slots && isObj(p)) d.plans[Number(k)] = { tacticId: typeof p.tacticId === "string" ? p.tacticId : "442", slots, dirty: !!p.dirty };
    }
  }
  if (Array.isArray(raw.custom)) {
    d.custom = raw.custom
      .map((c: any) => ({ id: c?.id, name: c?.name, slots: cleanSlots(c?.slots) }))
      .filter((c: any): c is CustomTactic => typeof c.id === "string" && typeof c.name === "string" && !!c.slots);
  }
  if (Array.isArray(raw.views)) {
    d.views = raw.views
      .filter((v: any) => isObj(v) && typeof v.id === "string" && typeof v.name === "string")
      .map((v: any) => ({ id: v.id, name: String(v.name), cols: cleanCols(v.cols) }));
  }
  d.cols = cleanCols(raw.cols);
  d.viewId = typeof raw.viewId === "string" ? raw.viewId : raw.viewId === null && Array.isArray(raw.cols) ? null : d.viewId;
  d.includeYouth = raw.includeYouth === true;
  if (isObj(raw.known)) {
    for (const [k, v] of Object.entries(raw.known)) if (isObj(v) && typeof v.name === "string") d.known[Number(k)] = { name: v.name };
  }
  d.lastSeason = num(raw.lastSeason) ? raw.lastSeason : null;
  return { ok: true, data: d };
}
