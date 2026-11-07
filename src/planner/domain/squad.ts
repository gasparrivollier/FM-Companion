import type { Contract, SnapshotPlayer, SquadKind } from "../../shared/snapshot.ts";
import { proposePositions, type Pos } from "./positions.ts";

/** The owner's own judgement for one player (always wins over the imported proposal). */
export interface Mark { natural: Pos[]; covers: Pos[]; hidden?: boolean }

export interface PlannerPlayer {
  uid: number;
  name: string;
  fullName: string;
  birthDate: string;
  squad: SquadKind;
  ca: number;
  contract: Contract | null;
  natural: Pos[];
  covers: Pos[];
  marked: boolean;
  hidden: boolean;
  snap: SnapshotPlayer;
}

export function buildPlayer(p: SnapshotPlayer, squad: SquadKind, mark?: Mark): PlannerPlayer {
  const pos = mark ? { natural: mark.natural, covers: mark.covers } : proposePositions(p.positionRatings);
  return {
    uid: p.uid, name: p.name, fullName: p.fullName, birthDate: p.birthDate, squad, ca: p.ca, contract: p.contract,
    natural: pos.natural.slice(), covers: pos.covers.slice(), marked: !!mark, hidden: !!mark?.hidden, snap: p,
  };
}

export function fitOf(p: Pick<PlannerPlayer, "natural" | "covers">, code: Pos): "nat" | "near" | "out" {
  if (p.natural.includes(code)) return "nat";
  return p.covers.includes(code) ? "near" : "out";
}
