import type { PositionCode } from "../../shared/snapshot.ts";

// Positions as the game shows them in Spanish (prototype lines 528-558).
export type Pos = "POR" | "DFI" | "DFC" | "DFD" | "CRI" | "CRD" | "MC" | "MEI" | "MEC" | "MED" | "MPI" | "MPC" | "MPD" | "DLC";
export type Group = "POR" | "DEF" | "CEN" | "DEL";

export const GROUP: Record<Pos, Group> = {
  POR: "POR", DFI: "DEF", DFC: "DEF", DFD: "DEF", CRI: "DEF", CRD: "DEF", MC: "CEN", MEI: "CEN", MEC: "CEN", MED: "CEN",
  MPI: "DEL", MPC: "DEL", MPD: "DEL", DLC: "DEL",
};
export const GCOL: Record<Group, string> = { POR: "#f0d264", DEF: "#5f9df2", CEN: "#4fd1a5", DEL: "#f28a5e" };
export const GLIST: Group[] = ["POR", "DEF", "CEN", "DEL"];
export const POS_LIST = Object.keys(GROUP) as Pos[];
export const VAR: Partial<Record<Pos, [string, string, string]>> = {
  DFC: ["DFCI", "DFC", "DFCD"], MEC: ["MECI", "MEC", "MECD"], MC: ["MCCI", "MC", "MCCD"],
  MPC: ["MPCI", "MPC", "MPCD"], DLC: ["DLCI", "DLC", "DLCD"],
};

export const ROLES: Record<Pos, string[]> = {
  POR: ['Portero','Portero cierre'],
  DFC: ['Defensa central','Defensa con salida de balón','Defensa sencillo','Defensa central abierto','Líbero'],
  DFI: ['Lateral','Lateral ofensivo','Lateral sencillo','Lateral invertido','Lateral organizador'],
  DFD: ['Lateral','Lateral ofensivo','Lateral sencillo','Lateral invertido','Lateral organizador'],
  CRI: ['Carrilero','Carrilero completo','Carrilero invertido','Carrilero organizador','Lateral'],
  CRD: ['Carrilero','Carrilero completo','Carrilero invertido','Carrilero organizador','Lateral'],
  MC:  ['Pivote','Mediocentro defensivo','Organizador retrasado','Recuperador de balón','Regista','Medio escudo'],
  MEC: ['Mediocentro','Box to box','Mezzala','Organizador retrasado','Organizador avanzado','Recuperador de balón','Organizador itinerante'],
  MEI: ['Mediocampista de banda','Extremo','Extremo defensivo','Organizador de banda'],
  MED: ['Mediocampista de banda','Extremo','Extremo defensivo','Organizador de banda'],
  MPI: ['Extremo','Delantero interior','Buscador de espacios','Organizador avanzado','Raumdeuter','Rol libre'],
  MPD: ['Extremo','Delantero interior','Buscador de espacios','Organizador avanzado','Raumdeuter','Rol libre'],
  MPC: ['Mediapunta','Organizador avanzado','Trequartista','Buscador de espacios','Rol libre'],
  DLC: ['Delantero avanzado','Delantero completo','Segundo delantero','Falso 9','Ariete','Delantero presionante','Hombre objetivo','Trequartista']
};

const FROM_SAVE: Record<PositionCode, Pos | null> = {
  GK: "POR", SW: null, DL: "DFI", DC: "DFC", DR: "DFD", WBL: "CRI", WBR: "CRD", DM: "MC", ML: "MEI", MC: "MEC", MR: "MED",
  AML: "MPI", AMC: "MPC", AMR: "MPD", ST: "DLC",
};
/** The prototype position for a save position code; the sweeper (SW) has none. */
export function fromSave(code: PositionCode): Pos | null {
  return FROM_SAVE[code];
}

/**
 * Proposal from the 15 familiarity values: natural = 20, covers = 15 or more. When nothing reaches 20 the single best
 * mapped position is natural, so a player always has one. Ties go to the order of POS_LIST.
 */
export function proposePositions(ratings: Record<PositionCode, number>): { natural: Pos[]; covers: Pos[] } {
  const byPos = new Map<Pos, number>();
  for (const [code, value] of Object.entries(ratings) as [PositionCode, number][]) {
    const pos = fromSave(code);
    if (pos) byPos.set(pos, value);
  }
  const ordered = POS_LIST.filter((p) => byPos.has(p));
  let natural = ordered.filter((p) => byPos.get(p) === 20);
  if (!natural.length) {
    // nothing at 20: the best mapped position; a sweeper (or a rating set with no mapped position) becomes a centre-back
    const best = ordered.reduce<Pos | null>((a, b) => (a === null || (byPos.get(b) ?? 0) > (byPos.get(a) ?? 0) ? b : a), null);
    const sweeper = ratings.SW ?? 0;
    natural = best === null || sweeper > (byPos.get(best) ?? 0) ? ["DFC"] : [best];
  }
  const covers = ordered.filter((p) => !natural.includes(p) && (byPos.get(p) ?? 0) >= 15);
  return { natural, covers };
}
