import { describe, expect, it } from "vitest";
import { dateAt, endOf } from "../../src/importer/contracts.ts";

describe("dateAt", () => {
  it("decodes day of year and year", () => {
    const b = Buffer.alloc(8);
    b.writeUInt16LE(96, 2);
    b.writeUInt16LE(2025, 4);
    expect(dateAt(b, 2)).toBe("2025-04-06");
  });
  it("returns null for the null date 01 00 6c 07 (1900-01-01)", () => {
    expect(dateAt(Buffer.from("01006c07", "hex"), 0)).toBeNull();
  });
  it("returns null outside the buffer", () => {
    expect(dateAt(Buffer.alloc(2), 0)).toBeNull();
    expect(dateAt(Buffer.alloc(8), -1)).toBeNull();
  });
});

describe("endOf", () => {
  const REC = 1000;
  function build(count: number): Buffer {
    const b = Buffer.alloc(2000);
    const k = 2;
    const p = REC - 9 - 29 * k;
    b.fill(0xff, p - 8, p - 4);
    b.writeUInt16LE(151, p); // day 151 of 2026 = 2026-05-31
    b.writeUInt16LE(2026, p + 2);
    b[p + 14] = count;
    b[p + 8] = 4; // squad status
    return b;
  }
  it("finds the end date, k and position when the event count agrees", () => {
    expect(endOf(build(1), REC, "2024-07-01")).toEqual({ end: "2026-05-31", k: 2, pos: REC - 9 - 58 });
  });
  it("rejects a candidate whose event count disagrees", () => {
    expect(endOf(build(5), REC, "2024-07-01")).toBeNull();
  });
  it("rejects an end date before the start", () => {
    expect(endOf(build(1), REC, "2027-01-01")).toBeNull();
  });
});
