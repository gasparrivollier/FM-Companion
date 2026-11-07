import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { reconcile } from "../../src/planner/domain/reconcile.ts";
import { kpis, statusLabel } from "../../src/planner/domain/stats.ts";
import { rowModel, visibleRows } from "../../src/planner/domain/table.ts";
import { initialState } from "../../src/planner/state/reducer.ts";
import { isSnapshot } from "../../src/shared/snapshot.ts";

const FILE = "out/snapshot.json";
describe.skipIf(!existsSync(FILE))("planner on the real snapshot", () => {
  const snap = JSON.parse(readFileSync(FILE, "utf8"));
  it("is a valid snapshot", () => { expect(isSnapshot(snap)).toBe(true); });
  it("builds every player with at least one natural position and renders every row", () => {
    const r = reconcile(defaultOwnerData(), snap);
    const total = snap.squads.first.length + snap.squads.reserves.length + snap.squads.u18.length;
    expect(r.players).toHaveLength(total);
    expect(r.players.every((p) => p.natural.length >= 1)).toBe(true);
    let s = initialState(r.data, r.players, snap.meta.gameDate, { id: snap.meta.club.id, nationOrdinal: snap.meta.club.nationOrdinal, name: snap.meta.club.name }, r.left);
    s = { ...s, data: { ...s.data, includeYouth: true } };
    const rows = visibleRows(s);
    expect(rows).toHaveLength(total);
    for (const p of rows) {
      const m = rowModel(s, p);
      expect(m.wage).toMatch(/^\$/);
      expect(m.exp === "–" || /^\d{4}$/.test(m.exp)).toBe(true);
      const code = p.contract?.squadStatusCode ?? null;
      expect(statusLabel(code) === null || typeof statusLabel(code) === "string").toBe(true);
    }
  });
  it("gives the documented approximate canteranos counts for the first team", () => {
    const r = reconcile(defaultOwnerData(), snap);
    const k = kpis(r.players, snap.meta.club);
    expect([k.total, k.local, k.of]).toEqual([5, 10, 31]);
  });
});
