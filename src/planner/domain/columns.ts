import { DEFAULT_COLS } from "./ownerData.ts";

export interface Col { k: string; label: string; w: string; mw: number; r?: boolean }
// Squad-table columns and the predefined views (prototype lines 561-577). The name column is always shown.
export const COLS: Col[] = [
  { k: "xi", label: "XI", w: "56px", mw: 56 },
  { k: "name", label: "Jugador", w: "minmax(130px,1.7fr)", mw: 130 },
  { k: "pos", label: "Natural", w: "110px", mw: 110 },
  { k: "cub", label: "Cubre", w: "150px", mw: 150 },
  { k: "age", label: "Edad", w: "44px", mw: 44, r: true },
  { k: "wage", label: "Sueldo/sem.", w: "84px", mw: 84, r: true },
  { k: "rating", label: "Rtg", w: "48px", mw: 48, r: true },
  { k: "exp", label: "Contrato", w: "84px", mw: 84, r: true },
  { k: "role", label: "Rol", w: "160px", mw: 160 },
];
export const VIEWS: { id: string; name: string; cols: string[] }[] = [
  { id: "basica", name: "Básica", cols: DEFAULT_COLS.slice() },
  { id: "tactica", name: "Táctica", cols: ["xi", "pos", "cub", "role", "rating"] },
  { id: "contratos", name: "Contratos", cols: ["xi", "pos", "age", "exp", "wage"] },
  { id: "finanzas", name: "Finanzas", cols: ["pos", "age", "wage", "exp"] },
];
