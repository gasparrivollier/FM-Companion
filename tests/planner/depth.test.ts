import { describe, expect, it } from "vitest";
import { bandsOf, moveInBand, pickInto, removeInBand, withBands } from "../../src/planner/domain/depth.ts";
import type { Slot } from "../../src/planner/domain/ownerData.ts";

const slot = (uid: number | null, alt: (number | null)[] = [], role: string | null = null): Slot => ({ code: "DFC", x: 50, y: 70, uid, role, alt });

describe("bandsOf", () => {
  it("splits alt into suplentes, recambios and otros", () => {
    expect(bandsOf(slot(1, [2, null, 3]))).toEqual({ t: 1, s: [2], r: [3], o: [] });
    expect(bandsOf(slot(null, [null, null, null, null, null, 9]))).toEqual({ t: null, s: [], r: [], o: [9] });
  });
  it("withBands is the inverse and normalises trailing gaps", () => {
    const s = withBands(slot(null), { t: 1, s: [2], r: [3], o: [] });
    expect(s.uid).toBe(1);
    expect(s.alt).toEqual([2, null, 3]);
    expect(bandsOf(s)).toEqual({ t: 1, s: [2], r: [3], o: [] });
  });
});

describe("pickInto", () => {
  it("swaps titulars when the player starts in another slot", () => {
    const slots = [slot(1), slot(2), slot(3), slot(4)];
    const r = pickInto(slots, 0, 4, "t");
    expect(r.message).toBeNull();
    expect([r.slots[0].uid, r.slots[3].uid]).toEqual([4, 1]);
    expect(slots[0].uid).toBe(1); // input untouched
  });
  it("refuses a third suplente with the exact message and leaves slots as they were", () => {
    const slots = [slot(1, [2, 3])];
    const r = pickInto(slots, 0, 9, "s");
    expect(r.message).toBe("Suplentes: franja completa (2/2). Quitá a alguien primero.");
    expect(r.slots).toEqual(slots);
  });
  it("does nothing when the player is already in that band", () => {
    const slots = [slot(1, [2])];
    const r = pickInto(slots, 0, 2, "s");
    expect(r.slots).toEqual(slots);
    expect(r.message).toBeNull();
  });
  it("moves a suplente up to titular and sends the old titular to his place", () => {
    const r = pickInto([slot(1, [2, 3])], 0, 3, "t");
    expect(bandsOf(r.slots[0])).toEqual({ t: 3, s: [2, 1], r: [], o: [] });
  });
  it("moves the titular down to a band", () => {
    const r = pickInto([slot(1, [])], 0, 1, "r");
    expect(bandsOf(r.slots[0])).toEqual({ t: null, s: [], r: [1], o: [] });
  });
});

describe("moveInBand and removeInBand", () => {
  it("swaps neighbours and ignores moves past the ends", () => {
    const s = slot(1, [2, 3]);
    expect(bandsOf(moveInBand(s, "s", 0, 1)).s).toEqual([3, 2]);
    expect(moveInBand(s, "s", 0, -1)).toEqual(s);
    expect(moveInBand(s, "s", 1, 1)).toEqual(s);
  });
  it("removing the titular keeps the depth and role", () => {
    const s = removeInBand(slot(1, [2], "Líbero"), "t", 0);
    expect(s.uid).toBeNull();
    expect(s.alt).toEqual([2]);
    expect(s.role).toBe("Líbero");
  });
  it("removes from a band by index", () => {
    expect(bandsOf(removeInBand(slot(1, [2, 3]), "s", 0)).s).toEqual([3]);
  });
});
