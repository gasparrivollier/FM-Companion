import { describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { chartsFor, kpis, statusLabel, xiTotals } from "../../src/planner/domain/stats.ts";
import { rowModel, visibleRows } from "../../src/planner/domain/table.ts";
import { buildPlayer } from "../../src/planner/domain/squad.ts";
import { blankSlots, PRESETS } from "../../src/planner/domain/tactics.ts";
import { activePlan, initialState, reduce, type PlannerState } from "../../src/planner/state/reducer.ts";
import { snapPlayer } from "../helpers/planner.ts";

const wage = (n: number) => ({ clubId: 1, wageGbpWeek: n, start: "2024-07-01", end: "2026-05-31", squadNumber: null, squadStatusCode: null });

function state(): PlannerState {
  const specs = [
    snapPlayer(1, { GK: 20 }, { contract: wage(1000), birthDate: "1995-01-01" }),
    snapPlayer(2, { DC: 20 }, { contract: wage(3000), birthDate: "2000-01-01", homeGrownClubs: [{ clubId: 1, qualifier: 1 }] }),
    snapPlayer(3, { DC: 20 }, { contract: wage(2000), birthDate: "2002-01-01", homeGrownClubs: [{ clubId: 9, qualifier: 1 }], homeGrownNations: [{ nationOrdinal: 1, qualifier: 8 }] }),
    snapPlayer(4, { ST: 20 }, { contract: null, birthDate: "2004-01-01" }),
  ];
  const players = specs.map((p) => buildPlayer(p, "first"));
  players.push(buildPlayer(snapPlayer(5, { DC: 20 }, { contract: wage(500) }), "reserves"));
  return initialState(defaultOwnerData(), players, "2025-04-06", { id: 1, nationOrdinal: 1, name: "C" }, []);
}

describe("chartsFor and xiTotals", () => {
  it("computes count, wages and average age by group of the first natural position", () => {
    const s = state();
    const first = s.players.filter((p) => p.squad === "first");
    const [count, wages, age] = chartsFor(first, [], "squad", 0, s.gameDate, s.data.settings);
    expect(count.total).toBe("4");
    expect(count.rows.map((r) => r.val)).toEqual(["1", "2", "0", "1"]);
    expect(wages.rows[1].val).toBe("$6K"); // (3000 + 2000) * 1.2492 = 6246
    expect(age.rows[2].val).toBe("–"); // no midfielders
    expect(age.rows[0].val).toBe("30,0"); // 1995-01-01 on 2025-04-06
  });
  it("scope xi only counts players in the XI", () => {
    let s = state();
    s = reduce(s, { type: "pick", uid: 2, slotIndex: 2 });
    const slots = activePlan(s).slots;
    const [count] = chartsFor(s.players, slots, "xi", 0, s.gameDate, s.data.settings);
    expect(count.total).toBe("1");
    const t = xiTotals(s.players, slots, 0, s.gameDate, s.data.settings);
    expect(t.filled).toBe(1);
    expect(t.wage).toBe("$4K");
    expect(t.ca).toBe("100");
  });
  it("an empty XI gives dashes", () => {
    const s = state();
    const t = xiTotals(s.players, blankSlots(PRESETS[0].slots), 0, s.gameDate, s.data.settings);
    expect([t.filled, t.age, t.ca]).toEqual([0, "–", "–"]);
  });
});

describe("kpis", () => {
  it("counts first-team players only, by the club id and the club nation", () => {
    const s = state();
    expect(kpis(s.players, s.club)).toEqual({ total: 1, local: 1, of: 4, approximate: true });
  });
});

describe("statusLabel", () => {
  it("labels only the seven known codes", () => {
    expect(statusLabel(4)).toBe("Jugador de plantilla");
    expect(statusLabel(11)).toBe("Futura promesa");
    expect(statusLabel(7)).toBeNull();
    expect(statusLabel(null)).toBeNull();
  });
});

describe("table", () => {
  it("hides Reservas and Sub-18 unless includeYouth, hides removed players", () => {
    let s = state();
    expect(visibleRows(s).map((p) => p.uid)).toEqual([1, 2, 3, 4]);
    s = reduce(s, { type: "toggleYouth" });
    expect(visibleRows(s)).toHaveLength(5);
    s = reduce(s, { type: "removePlayer", uid: 5 });
    expect(visibleRows(s)).toHaveLength(4);
  });
  it("filters by group, searches code and name, sorts by wage descending", () => {
    let s = state();
    s = reduce(s, { type: "setFilter", filter: "DEF" });
    expect(visibleRows(s).map((p) => p.uid).sort()).toEqual([2, 3]);
    s = reduce(s, { type: "setFilter", filter: "ALL" });
    s = reduce(s, { type: "setQuery", q: "DFC" });
    expect(visibleRows(s).map((p) => p.uid).sort()).toEqual([2, 3]);
    s = reduce(s, { type: "setQuery", q: "p4" });
    expect(visibleRows(s).map((p) => p.uid)).toEqual([4]);
    s = reduce(s, { type: "setQuery", q: "" });
    s = reduce(s, { type: "setSort", key: "wage" });
    expect(visibleRows(s).map((p) => p.uid)).toEqual([2, 3, 1, 4]);
  });
  it("sorting by xi puts players outside the XI last", () => {
    let s = state();
    s = reduce(s, { type: "pick", uid: 3, slotIndex: 2 });
    s = reduce(s, { type: "setSort", key: "xi" });
    expect(visibleRows(s)[0].uid).toBe(3);
  });
  it("a player with no contract has wage $0 and expiry dash; an expiring contract is flagged for a later season", () => {
    const s = state();
    const none = rowModel(s, s.players.find((p) => p.uid === 4)!);
    expect([none.wage, none.exp, none.expWarn]).toEqual(["$0", "–", false]);
    const later = reduce(s, { type: "setSeason", season: 2027 });
    const r = rowModel(later, later.players.find((p) => p.uid === 2)!);
    expect([r.exp, r.expWarn, r.age]).toEqual(["2026", true, 27]);
  });
});
