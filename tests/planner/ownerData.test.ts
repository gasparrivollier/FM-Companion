import { describe, expect, it } from "vitest";
import { OWNER_VERSION, defaultOwnerData, parseOwnerData, type Slot } from "../../src/planner/domain/ownerData.ts";

const slot = (code: string, i: number): Slot => ({ code: code as Slot["code"], x: 10 + i, y: 20, uid: null, role: null, alt: [] });
const eleven = () => Array.from({ length: 11 }, (_, i) => slot(i === 0 ? "POR" : "DFC", i));

describe("defaultOwnerData", () => {
  it("has the documented defaults", () => {
    const d = defaultOwnerData();
    expect(d.version).toBe(OWNER_VERSION);
    expect(d.settings).toEqual({
      team: "Mi equipo", c1: "#0b5d3b", c2: "#f2b84b", currency: "USD", usdPerGbp: 1.2492, eurPerGbp: 1.17, seasonEndOverride: null,
    });
    expect(d.plans).toEqual({});
    expect(d.includeYouth).toBe(false);
  });
});

describe("parseOwnerData", () => {
  it("rejects unparseable text as invalid", () => {
    const r = parseOwnerData("{");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });
  it("rejects a newer version and names both versions", () => {
    const r = parseOwnerData(JSON.stringify({ version: 2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("newer");
      expect(r.message).toContain("2");
      expect(r.message).toContain(String(OWNER_VERSION));
    }
  });
  it("treats a missing or non-numeric version as invalid, never as v1", () => {
    for (const v of ['{"settings":{}}', '{"version":"2"}', '{"version":null}']) {
      const r = parseOwnerData(v);
      expect(r.ok).toBe(false);
    }
  });
  it("round-trips a valid document", () => {
    const d = defaultOwnerData();
    d.plans[2026] = { tacticId: "442", slots: eleven(), dirty: false };
    d.marks[7] = { natural: ["DFC"], covers: ["DFD"] };
    d.known[7] = { name: "Ann" };
    const r = parseOwnerData(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(d);
  });
  it("repairs bad fields one by one without throwing", () => {
    const d = defaultOwnerData() as unknown as Record<string, any>;
    d.settings.c1 = "red";
    d.settings.usdPerGbp = -3;
    d.settings.currency = "XYZ";
    d.plans[2026] = { tacticId: "442", slots: eleven().slice(0, 5), dirty: false };
    d.plans[2027] = { tacticId: "442", slots: eleven(), dirty: true };
    d.cols = ["nope"];
    const r = parseOwnerData(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.settings.c1).toBe("#0b5d3b");
      expect(r.data.settings.usdPerGbp).toBe(1.2492);
      expect(r.data.settings.currency).toBe("USD");
      expect(Object.keys(r.data.plans)).toEqual(["2027"]);
      expect(r.data.cols).toEqual(["xi", "pos", "age", "wage", "rating", "exp"]);
    }
  });
});
