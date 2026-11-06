import { describe, expect, it } from "vitest";
import { SNAPSHOT_VERSION, isSnapshot, type Snapshot, type SnapshotPlayer } from "../../src/shared/snapshot.ts";

const POSITIONS = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"] as const;

function player(uid = 1): SnapshotPlayer {
  return {
    uid, id: uid + 100, name: "A B", fullName: "A Bee", birthDate: "2000-01-02", nationOrdinal: 167, ca: 100, pa: 120,
    positionRatings: Object.fromEntries(POSITIONS.map((p) => [p, 1])) as SnapshotPlayer["positionRatings"],
    attributes: { finishing: 10 }, heightCm: 180, weightKg: 75, contract: null, homeGrownClubs: [], homeGrownNations: [],
  };
}
function snapshot(): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "x.fm", gameVersion: "24.3.0+0", gameDate: "2025-04-06", importedAt: "2026-11-06T00:00:00Z",
      importerVersion: "1", club: { id: 1122, uid: 1535, name: "Aberdeen", nationOrdinal: 167 } },
    squads: { first: [player()], reserves: [], u18: [] },
    warnings: [],
  };
}

describe("snapshot contract", () => {
  it("accepts a minimal valid snapshot", () => {
    expect(isSnapshot(snapshot())).toBe(true);
  });
  it("rejects a wrong version", () => {
    expect(isSnapshot({ ...snapshot(), version: 2 })).toBe(false);
  });
  it("rejects a squad that is not an array", () => {
    const s = snapshot() as unknown as { squads: Record<string, unknown> };
    s.squads.u18 = {};
    expect(isSnapshot(s)).toBe(false);
  });
  it("rejects a player without uid", () => {
    const s = snapshot();
    delete (s.squads.first[0] as Partial<SnapshotPlayer>).uid;
    expect(isSnapshot(s)).toBe(false);
  });
});
