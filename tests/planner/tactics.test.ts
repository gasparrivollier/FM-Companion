import { describe, expect, it } from "vitest";
import { PRESETS, blankSlots, remap, slotLabels } from "../../src/planner/domain/tactics.ts";
import type { Slot } from "../../src/planner/domain/ownerData.ts";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

describe("PRESETS", () => {
  it("has the eight formations, each with 11 slots, one goalkeeper, coordinates inside the pitch", () => {
    expect(PRESETS.map((p) => p.name)).toEqual(["4-4-2", "4-2-3-1", "4-3-3", "4-1-4-1", "4-1-2-1-2", "3-5-2", "3-4-3", "5-3-2"]);
    for (const p of PRESETS) {
      expect(p.slots).toHaveLength(11);
      expect(p.slots.filter((s) => s.code === "POR")).toHaveLength(1);
      for (const s of p.slots) {
        expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(100);
        expect(s.uid).toBeNull(); expect(s.alt).toEqual([]);
      }
    }
  });
});

describe("slotLabels", () => {
  it("adds sides when two or more slots share a base position", () => {
    expect(slotLabels(preset("442").slots)).toEqual(["POR", "DFI", "DFCI", "DFCD", "DFD", "MEI", "MECI", "MECD", "MED", "DLCI", "DLCD"]);
  });
  it("keeps the plain code for a single slot, and uses the middle label for three", () => {
    expect(slotLabels(preset("433").slots)[9]).toBe("DLC");
    expect(slotLabels(preset("352").slots).slice(1, 4)).toEqual(["DFCI", "DFC", "DFCD"]);
  });
});

describe("remap", () => {
  const filled = (): Slot[] => {
    const s = blankSlots(preset("442").slots);
    s[2] = { ...s[2], uid: 10, role: "Líbero", alt: [11] };
    s[6] = { ...s[6], uid: 20 };
    s[5] = { ...s[5], uid: 30 };
    return s;
  };
  it("keeps same-position players with role and depth, then same-group players, and fills nothing else", () => {
    const out = remap(filled(), preset("433").slots);
    expect(out).toHaveLength(11);
    expect(out[2]).toMatchObject({ code: "DFC", uid: 10, role: "Líbero", alt: [11] });
    expect(out[6]).toMatchObject({ code: "MEC", uid: 20 });
    expect(out[5]).toMatchObject({ code: "MC", uid: 30, role: null, alt: [] });
    expect(out.filter((s) => s.uid !== null)).toHaveLength(3);
  });
  it("drops a player when no slot of his group is left", () => {
    const s = blankSlots(preset("442").slots);
    s[9] = { ...s[9], uid: 99 };
    const out = remap(s, preset("532").slots);
    expect(out.some((o) => o.uid === 99)).toBe(true); // DLC exists in 5-3-2
    const out2 = remap(s, [{ code: "POR", x: 50, y: 91, uid: null, role: null, alt: [] }, ...preset("532").slots.slice(1, 6)]);
    expect(out2.some((o) => o.uid === 99)).toBe(false);
  });
});
