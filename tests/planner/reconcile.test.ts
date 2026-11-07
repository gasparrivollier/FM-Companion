import { describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { reconcile } from "../../src/planner/domain/reconcile.ts";
import { tabs } from "../../src/planner/domain/season.ts";
import { blankSlots, PRESETS } from "../../src/planner/domain/tactics.ts";
import { activePlan, initialState, isLeft, reduce } from "../../src/planner/state/reducer.ts";
import { SNAPSHOT_VERSION, type Snapshot, type SnapshotPlayer } from "../../src/shared/snapshot.ts";
import { snapPlayer } from "../helpers/planner.ts";

function snap(first: SnapshotPlayer[], gameDate = "2025-04-06", reserves: SnapshotPlayer[] = []): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "x.fm", gameVersion: "24.3.0+0", gameDate, importedAt: "now", importerVersion: "1", club: { id: 1, uid: 2, name: "C", nationOrdinal: 1 } },
    squads: { first, reserves, u18: [] }, warnings: [],
  };
}

describe("reconcile", () => {
  it("keeps a planned player who left the squad, flags him, and deletes nothing", () => {
    const data = defaultOwnerData();
    const slots = blankSlots(PRESETS[0].slots);
    slots[0] = { ...slots[0], uid: 7, alt: [8] };
    data.plans[2025] = { tacticId: "442", slots, dirty: false };
    data.known[7] = { name: "Ann Old" };
    const before = structuredClone(data);
    const r = reconcile(data, snap([snapPlayer(1, { GK: 20 }), snapPlayer(8, { DC: 20 })]));
    expect(r.left).toEqual([7]);
    expect(r.data.plans).toEqual(before.plans);
    expect(r.data.known[7].name).toBe("Ann Old");
    expect(r.data.known[8].name).toBe("P8");
    expect(data).toEqual(before); // input not mutated
    const state = initialState(r.data, r.players, "2025-04-06", { id: 1, nationOrdinal: 1, name: "C" }, r.left);
    expect(activePlan(state).slots[0].uid).toBe(7);
    expect([isLeft(state, 7), isLeft(state, 8)]).toEqual([true, false]);
    expect(reduce(state, { type: "pick", uid: 7, slotIndex: 3 })).toBe(state); // a player who left cannot be picked
  });
  it("lets a manual mark win over a changed proposal", () => {
    const data = defaultOwnerData();
    data.marks[5] = { natural: ["DFC"], covers: [] };
    const r = reconcile(data, snap([snapPlayer(5, { DR: 20 })]));
    const p = r.players.find((x) => x.uid === 5)!;
    expect(p.natural).toEqual(["DFC"]);
    expect(p.marked).toBe(true);
  });
  it("a later-season snapshot shifts the tabs and keeps the old plan", () => {
    const data = defaultOwnerData();
    data.plans[2025] = { tacticId: "442", slots: blankSlots(PRESETS[0].slots), dirty: false };
    data.lastSeason = 2025;
    const r = reconcile(data, snap([snapPlayer(1, { GK: 20 })], "2026-08-01"));
    expect(r.season).toBe(2027);
    expect(tabs(r.season)).toEqual([2027, 2028, 2029]);
    expect(r.data.plans[2025]).toBeDefined();
    expect(r.data.lastSeason).toBe(2027);
  });
  it("builds players for all squads with their kind, first squad wins on a repeated uid", () => {
    const r = reconcile(defaultOwnerData(), snap([snapPlayer(1, { GK: 20 })], "2025-04-06", [snapPlayer(2, { DC: 20 }), snapPlayer(1, { GK: 20 })]));
    expect(r.players.map((p) => [p.uid, p.squad])).toEqual([[1, "first"], [2, "reserves"]]);
  });
  it("loadSnapshot swaps the players and keeps the selected season when it is still in range", () => {
    const data = defaultOwnerData();
    let s = initialState(data, [], "2025-04-06", { id: 1, nationOrdinal: 1, name: "C" }, []);
    s = reduce(s, { type: "setSeason", season: 2026 });
    s = reduce(s, { type: "loadSnapshot", snapshot: snap([snapPlayer(1, { GK: 20 })]) });
    expect(s.players.map((p) => p.uid)).toEqual([1]);
    expect(s.season).toBe(2026);
    s = reduce(s, { type: "loadSnapshot", snapshot: snap([snapPlayer(1, { GK: 20 })], "2027-09-01") });
    expect(s.base).toBe(2028);
    expect(s.season).toBe(2028);
  });
});
