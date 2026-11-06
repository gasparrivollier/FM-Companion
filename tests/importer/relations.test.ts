import { describe, expect, it } from "vitest";
import { homeGrownFrom, readRelations, type RelationEntry } from "../../src/importer/relations.ts";

const PERSON = 10;
const N = 5; // bytes counted by the u32 at person+15
const END = PERSON + 19 + N;

/** Builds a buffer holding a person record whose relation table has the given entries. */
function build(entries: [number, number, number, number][], flag = 1): Buffer {
  const b = Buffer.alloc(END + 35 + entries.length * 16 + 64);
  b.writeUInt32LE(N, PERSON + 15);
  b[END + 33] = flag;
  b[END + 34] = entries.length;
  entries.forEach(([id, kind, role, q], k) => {
    const p = END + 35 + k * 16;
    b.writeUInt32LE(id, p);
    b[p + 10] = kind;
    b[p + 11] = role;
    b[p + 12] = q;
    b[p + 15] = 255;
  });
  return b;
}

describe("readRelations", () => {
  it("returns null when the flag byte is not 1", () => {
    expect(readRelations(build([[1123, 1, 72, 1]], 0), PERSON)).toBeNull();
  });
  it("returns null when the table overruns the identity offset", () => {
    const b = build([[1123, 1, 72, 1], [167, 8, 70, 2]]);
    expect(readRelations(b, PERSON, END + 35 + 16)).toBeNull();
  });
  it("reads referenced id, kind, role, qualifier and sentinel of each entry", () => {
    const got = readRelations(build([[1123, 1, 72, 8], [167, 8, 70, 2]]), PERSON);
    expect(got).toEqual([
      { referencedId: 1123, kind: 1, role: 72, qualifier: 8, sentinel: 255 },
      { referencedId: 167, kind: 8, role: 70, qualifier: 2, sentinel: 255 },
    ]);
  });
});

describe("homeGrownFrom", () => {
  it("extracts home-grown clubs (id - 1) and nations, keeping qualifiers", () => {
    const e = (referencedId: number, kind: number, role: number, qualifier: number): RelationEntry =>
      ({ referencedId, kind, role, qualifier, sentinel: 255 });
    const r = homeGrownFrom([e(1123, 1, 72, 1), e(1123, 1, 72, 8), e(167, 8, 70, 2), e(96113, 3, 1, 10)]);
    expect(r.clubs).toEqual([{ clubId: 1122, qualifier: 1 }, { clubId: 1122, qualifier: 8 }]);
    expect(r.nations).toEqual([{ nationOrdinal: 167, qualifier: 2 }]);
  });
});
