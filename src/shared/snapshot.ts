// The snapshot is the contract between the importer (reads the save) and the planner (reads only this file).
export const SNAPSHOT_VERSION = 1;

export type SquadKind = "first" | "reserves" | "u18";
export type PositionCode =
  | "GK" | "SW" | "DL" | "DC" | "DR" | "DM" | "ML" | "MC" | "MR" | "AML" | "AMC" | "AMR" | "ST" | "WBL" | "WBR";

export interface Contract {
  clubId: number;
  wageGbpWeek: number;
  start: string;
  end: string | null;
  squadNumber: number | null; // 255 in the save means none
  squadStatusCode: number | null;
}
export interface HomeGrownClub { clubId: number; qualifier: number }
export interface HomeGrownNation { nationOrdinal: number; qualifier: number }

export interface SnapshotPlayer {
  uid: number;
  id: number;
  name: string;
  fullName: string;
  birthDate: string;
  nationOrdinal: number;
  ca: number;
  pa: number;
  positionRatings: Record<PositionCode, number>;
  attributes: Record<string, number>; // displayed values 1-20, parser keys
  heightCm: number | null;
  weightKg: number | null;
  contract: Contract | null;
  homeGrownClubs: HomeGrownClub[];
  homeGrownNations: HomeGrownNation[];
}

export interface SnapshotMeta {
  saveFileName: string;
  gameVersion: string;
  gameDate: string;
  importedAt: string;
  importerVersion: string;
  club: { id: number; uid: number; name: string; nationOrdinal: number };
}

export interface Snapshot {
  version: typeof SNAPSHOT_VERSION;
  meta: SnapshotMeta;
  squads: Record<SquadKind, SnapshotPlayer[]>;
  warnings: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string";

function isPlayer(p: unknown): boolean {
  return isObj(p) && isNum(p.uid) && isNum(p.id) && isStr(p.name) && isStr(p.birthDate) &&
    isObj(p.positionRatings) && isObj(p.attributes) && Array.isArray(p.homeGrownClubs) && Array.isArray(p.homeGrownNations);
}

export function isSnapshot(x: unknown): x is Snapshot {
  if (!isObj(x) || x.version !== SNAPSHOT_VERSION) return false;
  const m = x.meta;
  if (!isObj(m) || !isStr(m.saveFileName) || !isStr(m.gameVersion) || !isStr(m.gameDate) || !isStr(m.importedAt) ||
      !isStr(m.importerVersion) || !isObj(m.club) || !isNum(m.club.id) || !isNum(m.club.uid) || !isStr(m.club.name)) return false;
  const s = x.squads;
  if (!isObj(s)) return false;
  for (const k of ["first", "reserves", "u18"]) {
    const arr = s[k];
    if (!Array.isArray(arr) || !arr.every(isPlayer)) return false;
  }
  return Array.isArray(x.warnings);
}
