import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../../src/importer/compare.ts";
import { SNAPSHOT_VERSION, type Snapshot, type SnapshotPlayer } from "../../src/shared/snapshot.ts";

const POS = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"];
function player(uid: number, fullName: string, birthDate: string): SnapshotPlayer {
  return {
    uid, id: uid, name: fullName, fullName, birthDate, nationOrdinal: 1, ca: 1, pa: 1,
    positionRatings: Object.fromEntries(POS.map((p) => [p, 1])) as SnapshotPlayer["positionRatings"], attributes: {},
    heightCm: null, weightKg: null, contract: null, homeGrownClubs: [], homeGrownNations: [],
  };
}
function snap(first: SnapshotPlayer[], reserves: SnapshotPlayer[] = [], u18: SnapshotPlayer[] = []): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "x.fm", gameVersion: "24.3.0+0", gameDate: "2025-04-06", importedAt: "now", importerVersion: "1",
      club: { id: 1, uid: 2, name: "C", nationOrdinal: 1 } },
    squads: { first, reserves, u18 }, warnings: [],
  };
}

describe("compareSnapshots", () => {
  it("counts shared uids and reports the ones whose identity changed", () => {
    const a = snap([player(1, "A Bee", "2000-01-01"), player(2, "C Dee", "1999-05-05")], [player(3, "E Eff", "2001-02-02")], [player(9, "Only A", "2008-01-01")]);
    const b = snap([player(1, "A Bee", "2000-01-01")], [player(2, "C Dee", "1999-05-05")], [player(3, "E Eff", "2002-02-02"), player(10, "Only B", "2009-01-01")]);
    expect(compareSnapshots(a, b)).toEqual({
      common: 3,
      sameIdentity: 2,
      changedIdentity: [{ uid: 3, a: "E Eff 2001-02-02", b: "E Eff 2002-02-02" }],
      onlyInA: [9],
      onlyInB: [10],
    });
  });
  it("reports nothing changed for identical snapshots", () => {
    const a = snap([player(1, "A Bee", "2000-01-01")]);
    expect(compareSnapshots(a, a)).toEqual({ common: 1, sameIdentity: 1, changedIdentity: [], onlyInA: [], onlyInB: [] });
  });
});
