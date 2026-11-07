import { defaultOwnerData, type OwnerData } from "../../src/planner/domain/ownerData.ts";
import { buildPlayer } from "../../src/planner/domain/squad.ts";
import { initialState, type PlannerState } from "../../src/planner/state/reducer.ts";
import type { PositionCode, SnapshotPlayer, SquadKind } from "../../src/shared/snapshot.ts";

const CODES: PositionCode[] = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"];

export function snapPlayer(uid: number, rating: Partial<Record<PositionCode, number>>, extra: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    uid, id: uid, name: `P${uid}`, fullName: `Player ${uid}`, birthDate: "2000-01-01", nationOrdinal: 1, ca: 100, pa: 120,
    positionRatings: Object.fromEntries(CODES.map((c) => [c, rating[c] ?? 1])) as Record<PositionCode, number>,
    attributes: {}, heightCm: 180, weightKg: 75,
    contract: { clubId: 1, wageGbpWeek: 1000, start: "2024-07-01", end: "2026-05-31", squadNumber: null, squadStatusCode: null },
    homeGrownClubs: [], homeGrownNations: [], ...extra,
  };
}

/** A small state: uid 1 GK, 2 and 3 DC, 4 DR (covers DC? no), 5 ST; season 2025 (game date 2025-04-06). */
export function makeState(over: Partial<PlannerState> = {}, data: OwnerData = defaultOwnerData()): PlannerState {
  const specs: [number, Partial<Record<PositionCode, number>>, SquadKind][] = [
    [1, { GK: 20 }, "first"], [2, { DC: 20 }, "first"], [3, { DC: 20, DR: 16 }, "first"], [4, { DR: 20 }, "first"], [5, { ST: 20 }, "first"],
    [6, { DC: 20 }, "reserves"],
  ];
  const players = specs.map(([uid, r, sq]) => buildPlayer(snapPlayer(uid, r), sq, data.marks[uid]));
  return { ...initialState(data, players, "2025-04-06", { id: 1, nationOrdinal: 1, name: "C" }, []), ...over };
}
