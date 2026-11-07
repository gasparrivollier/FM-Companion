import { describe, expect, it } from "vitest";
import { activePlan, reduce } from "../../src/planner/state/reducer.ts";
import { bandsOf } from "../../src/planner/domain/depth.ts";
import { makeState } from "../helpers/planner.ts";

describe("seasons and plans", () => {
  it("an unseen season clones the current plan and keeps the old one", () => {
    let s = makeState();
    s = reduce(s, { type: "pick", uid: 1, slotIndex: 0 });
    s = reduce(s, { type: "setSeason", season: 2026 });
    expect(s.season).toBe(2026);
    expect(s.data.plans[2026].slots[0].uid).toBe(1);
    expect(s.data.plans[2025].slots[0].uid).toBe(1);
    s = reduce(s, { type: "clearXI" });
    expect(s.data.plans[2025].slots[0].uid).toBe(1);
    expect(activePlan(s).slots[0].uid).toBeNull();
  });
  it("copyPlan copies the base season into the selected one and is a no-op on the base season", () => {
    let s = makeState();
    s = reduce(s, { type: "pick", uid: 1, slotIndex: 0 });
    const same = reduce(s, { type: "copyPlan" });
    expect(same).toBe(s);
    s = reduce(s, { type: "setSeason", season: 2026 });
    s = reduce(s, { type: "clearXI" });
    s = reduce(s, { type: "copyPlan" });
    expect(activePlan(s).slots[0].uid).toBe(1);
  });
});

describe("tactics", () => {
  it("selectTactic remaps, keeps players and clears dirty", () => {
    let s = makeState();
    s = reduce(s, { type: "pick", uid: 2, slotIndex: 2 });
    s = reduce(s, { type: "moveSlot", index: 0, x: 40, y: 80 });
    expect(activePlan(s).dirty).toBe(true);
    s = reduce(s, { type: "selectTactic", id: "433" });
    const p = activePlan(s);
    expect(p.tacticId).toBe("433");
    expect(p.dirty).toBe(false);
    expect(p.slots.find((x) => x.uid === 2)?.code).toBe("DFC");
  });
  it("saves a custom tactic with a default name, cuts long names, updates and deletes", () => {
    let s = makeState();
    s = reduce(s, { type: "saveNewTactic", name: "", id: "c1" });
    expect(s.data.custom[0].name).toBe("Táctica 1");
    s = reduce(s, { type: "saveNewTactic", name: "x".repeat(50), id: "c2" });
    expect(s.data.custom[1].name).toHaveLength(32);
    s = reduce(s, { type: "moveSlot", index: 1, x: 20, y: 60 });
    s = reduce(s, { type: "updateTactic" });
    expect(s.data.custom[1].slots[1].x).toBe(20);
    expect(activePlan(s).dirty).toBe(false);
    s = reduce(s, { type: "deleteTactic" });
    expect(s.data.custom.map((c) => c.id)).toEqual(["c1"]);
    expect(activePlan(s).tacticId).toBe("442");
  });
  it("clamps dragged slots inside the pitch", () => {
    const s = reduce(makeState(), { type: "moveSlot", index: 0, x: 200, y: -5 });
    expect([activePlan(s).slots[0].x, activePlan(s).slots[0].y]).toEqual([94, 5]);
  });
});

describe("slots and depth", () => {
  it("pick with a slot index makes a titular; clearXI keeps roles", () => {
    let s = makeState();
    s = reduce(s, { type: "selectSlot", index: 2 });
    s = reduce(s, { type: "setRole", role: "Líbero" });
    s = reduce(s, { type: "pick", uid: 2, slotIndex: 2 });
    s = reduce(s, { type: "clearXI" });
    expect(activePlan(s).slots[2]).toMatchObject({ uid: null, role: "Líbero" });
  });
  it("pick into a band of the selected slot, refusing a full band", () => {
    let s = makeState();
    s = reduce(s, { type: "selectSlot", index: 2 });
    s = reduce(s, { type: "setBand", band: "s" });
    s = reduce(s, { type: "pick", uid: 2 });
    s = reduce(s, { type: "pick", uid: 3 });
    expect(bandsOf(activePlan(s).slots[2]).s).toEqual([2, 3]);
    expect(s.band).toBe("r"); // a full band moves the cursor on
    s = reduce(s, { type: "setBand", band: "s" });
    s = reduce(s, { type: "pick", uid: 4 });
    expect(s.bandMsg).toContain("franja completa");
    expect(bandsOf(activePlan(s).slots[2]).s).toEqual([2, 3]);
  });
  it("picking a titular moves the cursor to the next empty slot", () => {
    let s = makeState();
    s = reduce(s, { type: "selectSlot", index: 0 });
    s = reduce(s, { type: "pick", uid: 1 });
    expect(activePlan(s).slots[0].uid).toBe(1);
    expect(s.sel).toBe(1);
  });
});

describe("position marks", () => {
  it("cycles not covered, natural, covers, not covered and stores the mark", () => {
    let s = makeState();
    const p = () => s.players.find((x) => x.uid === 4)!;
    expect(p().natural).toEqual(["DFD"]);
    s = reduce(s, { type: "cyclePos", uid: 4, code: "DFC" });
    expect(p().natural).toEqual(["DFD", "DFC"]);
    s = reduce(s, { type: "cyclePos", uid: 4, code: "DFC" });
    expect(p().natural).toEqual(["DFD"]);
    expect(p().covers).toContain("DFC");
    s = reduce(s, { type: "cyclePos", uid: 4, code: "DFC" });
    expect(p().covers).not.toContain("DFC");
    expect(s.data.marks[4]).toBeDefined();
    expect(p().marked).toBe(true);
  });
  it("refuses to remove the last natural position", () => {
    const s0 = makeState();
    const s = reduce(s0, { type: "cyclePos", uid: 4, code: "DFD" });
    expect(s.posMsg).toBe("Dejá al menos una posición natural: primero marcá otra como natural.");
    expect(s.players.find((x) => x.uid === 4)!.natural).toEqual(["DFD"]);
    expect(s.data.marks[4]).toBeUndefined();
  });
  it("setPrimary reorders the naturals", () => {
    let s = makeState();
    s = reduce(s, { type: "cyclePos", uid: 4, code: "DFC" });
    s = reduce(s, { type: "setPrimary", uid: 4, code: "DFC" });
    expect(s.players.find((x) => x.uid === 4)!.natural).toEqual(["DFC", "DFD"]);
  });
});

describe("known names and the season override", () => {
  it("picking a player records his name so he can be shown after he leaves the squad", () => {
    let s = makeState();
    s = reduce(s, { type: "pick", uid: 1, slotIndex: 0 });
    expect(s.data.known[1]).toEqual({ name: "P1" });
  });
  it("changing the season-end override keeps the selected season inside the new tabs", () => {
    let s = makeState();
    s = reduce(s, { type: "setSettings", patch: { seasonEndOverride: 2026 } });
    expect(s.base).toBe(2026);
    expect(s.season).toBe(2026);
  });
  it("keeps the selected season when it is still one of the tabs", () => {
    let s = makeState();
    s = reduce(s, { type: "setSeason", season: 2027 });
    s = reduce(s, { type: "setSettings", patch: { seasonEndOverride: 2026 } });
    expect(s.season).toBe(2027);
  });
});

describe("views, columns, settings", () => {
  it("toggleCol never empties the list and detaches from the named view", () => {
    let s = makeState();
    for (const k of s.data.cols.slice()) s = reduce(s, { type: "toggleCol", key: k });
    expect(s.data.cols).toHaveLength(1);
    expect(s.data.viewId).toBeNull();
  });
  it("saves and deletes a view", () => {
    let s = makeState();
    s = reduce(s, { type: "toggleCol", key: "role" });
    s = reduce(s, { type: "saveView", name: "", id: "v1" });
    expect(s.data.views[0]).toMatchObject({ id: "v1", name: "Vista 1" });
    expect(s.data.viewId).toBe("v1");
    s = reduce(s, { type: "deleteView" });
    expect(s.data.views).toEqual([]);
    expect(s.data.viewId).toBe("basica");
  });
  it("changing settings leaves the plans alone", () => {
    let s = makeState();
    s = reduce(s, { type: "pick", uid: 1, slotIndex: 0 });
    const plans = s.data.plans;
    s = reduce(s, { type: "setSettings", patch: { currency: "EUR" } });
    expect(s.data.settings.currency).toBe("EUR");
    expect(s.data.plans).toBe(plans);
  });
});
