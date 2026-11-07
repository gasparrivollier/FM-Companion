import { describe, expect, it } from "vitest";
import { fromSave, proposePositions, GROUP } from "../../src/planner/domain/positions.ts";
import { buildPlayer, fitOf } from "../../src/planner/domain/squad.ts";
import type { PositionCode, SnapshotPlayer } from "../../src/shared/snapshot.ts";

const CODES: PositionCode[] = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"];
const ratings = (o: Partial<Record<PositionCode, number>>) =>
  Object.fromEntries(CODES.map((c) => [c, o[c] ?? 1])) as Record<PositionCode, number>;

function snapPlayer(r: Partial<Record<PositionCode, number>>, uid = 1): SnapshotPlayer {
  return {
    uid, id: uid, name: "P", fullName: "P Q", birthDate: "2000-01-01", nationOrdinal: 1, ca: 100, pa: 120,
    positionRatings: ratings(r), attributes: {}, heightCm: null, weightKg: null, contract: null,
    homeGrownClubs: [], homeGrownNations: [],
  };
}

describe("fromSave", () => {
  it("maps the 14 displayable codes and ignores SW", () => {
    const m = Object.fromEntries(CODES.map((c) => [c, fromSave(c)]));
    expect(m).toEqual({
      GK: "POR", SW: null, DL: "DFI", DC: "DFC", DR: "DFD", DM: "MC", ML: "MEI", MC: "MEC", MR: "MED",
      AML: "MPI", AMC: "MPC", AMR: "MPD", ST: "DLC", WBL: "CRI", WBR: "CRD",
    });
    expect(Object.keys(GROUP)).toHaveLength(14);
  });
});

describe("proposePositions", () => {
  it("natural = 20, covers = 15 or more, below 15 ignored", () => {
    expect(proposePositions(ratings({ DC: 20, DR: 17, DL: 14 }))).toEqual({ natural: ["DFC"], covers: ["DFD"] });
  });
  it("two 20s give two naturals", () => {
    expect(proposePositions(ratings({ DC: 20, MC: 20 })).natural).toEqual(["DFC", "MEC"]);
  });
  it("without a 20 the single best position is natural", () => {
    expect(proposePositions(ratings({ AMC: 18, ST: 16 }))).toEqual({ natural: ["MPC"], covers: ["DLC"] });
  });
  it("ignores SW and never returns an empty natural list", () => {
    const p = proposePositions(ratings({ SW: 20, DC: 12 }));
    expect(p.natural).toEqual(["DFC"]);
    expect(p.covers).toEqual([]);
  });
});

describe("buildPlayer and fitOf", () => {
  const snap = snapPlayer({ DC: 20, DR: 17 });
  it("uses the proposal when there is no mark", () => {
    const p = buildPlayer(snap, "first");
    expect([p.natural, p.covers, p.marked]).toEqual([["DFC"], ["DFD"], false]);
  });
  it("uses the owner's mark when there is one", () => {
    const p = buildPlayer(snap, "reserves", { natural: ["DFI"], covers: [] });
    expect([p.natural, p.covers, p.marked, p.squad]).toEqual([["DFI"], [], true, "reserves"]);
  });
  it("fitOf is nat, near or out", () => {
    const p = buildPlayer(snap, "first");
    expect([fitOf(p, "DFC"), fitOf(p, "DFD"), fitOf(p, "DLC")]).toEqual(["nat", "near", "out"]);
  });
});
