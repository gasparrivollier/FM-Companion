import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ImportError, sanityWarnings, toImportError, writeSnapshotAtomically } from "../../src/importer/validate.ts";
import { SaveError } from "../../src/importer/savelens/archive.ts";
import { buildSnapshotFrom } from "../../src/importer/snapshot.ts";
import type { ParsedSave } from "../../src/importer/savelens/index.ts";
import { SNAPSHOT_VERSION, type Snapshot, type SnapshotPlayer } from "../../src/shared/snapshot.ts";

const POS = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"];
function player(uid: number, wage = 1000, birth = "2000-01-01"): SnapshotPlayer {
  return {
    uid, id: uid, name: `P${uid}`, fullName: `P${uid}`, birthDate: birth, nationOrdinal: 1, ca: 1, pa: 1,
    positionRatings: Object.fromEntries(POS.map((p) => [p, 1])) as SnapshotPlayer["positionRatings"], attributes: {},
    heightCm: 180, weightKg: 70,
    contract: { clubId: 1, wageGbpWeek: wage, start: "2024-07-01", end: "2026-05-31", squadNumber: null, squadStatusCode: null },
    homeGrownClubs: [], homeGrownNations: [],
  };
}
function snapshot(first: SnapshotPlayer[]): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "x.fm", gameVersion: "24.3.0+0", gameDate: "2025-04-06", importedAt: "now", importerVersion: "1",
      club: { id: 1, uid: 2, name: "C", nationOrdinal: 1 } },
    squads: { first, reserves: [], u18: [] }, warnings: [],
  };
}

describe("sanityWarnings", () => {
  it("flags a first team of 3 players", () => {
    expect(sanityWarnings(snapshot([player(1), player(2), player(3)])).join(" ")).toContain("first team has 3 players");
  });
  it("flags a wage of 0", () => {
    const first = Array.from({ length: 20 }, (_, i) => player(i + 1, i === 0 ? 0 : 1000));
    expect(sanityWarnings(snapshot(first)).join(" ")).toContain("wage outside");
  });
  it("is quiet for a plausible squad", () => {
    expect(sanityWarnings(snapshot(Array.from({ length: 25 }, (_, i) => player(i + 1))))).toEqual([]);
  });
});

describe("toImportError", () => {
  it("keeps an ImportError as it is", () => {
    const e = new ImportError("NO_MANAGED_CLUB", "x");
    expect(toImportError(e)).toBe(e);
  });
  it("maps the parser's UNSUPPORTED_VERSION to the same code", () => {
    expect(toImportError(new SaveError("UNSUPPORTED_VERSION", "v")).code).toBe("UNSUPPORTED_VERSION");
  });
  it("maps a non-FM file and a missing file to NOT_A_SAVE", () => {
    expect(toImportError(new SaveError("UNSUPPORTED_FORMAT", "f")).code).toBe("NOT_A_SAVE");
    expect(toImportError(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" })).code).toBe("NOT_A_SAVE");
  });
  it("maps damaged saves to TRUNCATED", () => {
    expect(toImportError(new SaveError("INVALID_MANIFEST", "m")).code).toBe("TRUNCATED");
    expect(toImportError(new SaveError("CORRUPT_COMPRESSION", "c")).code).toBe("TRUNCATED");
  });
  it("maps allocation failures to OUT_OF_MEMORY and anything else to INTERNAL keeping the message", () => {
    expect(toImportError(new RangeError("Array buffer allocation failed")).code).toBe("OUT_OF_MEMORY");
    const e = toImportError(new Error("boom"));
    expect([e.code, e.message]).toEqual(["INTERNAL", "boom"]);
  });
});

describe("writeSnapshotAtomically", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "fm-snap-"));
  it("leaves no file at the target when serialisation throws", () => {
    const d = dir();
    const bad = { ...snapshot([player(1)]), warnings: [1n as unknown as string] };
    expect(() => writeSnapshotAtomically(join(d, "s.json"), bad)).toThrow();
    expect(readdirSync(d)).toEqual([]);
  });
  it("keeps the previous snapshot when the new one fails, and replaces it on success", () => {
    const d = dir();
    const target = join(d, "s.json");
    writeFileSync(target, "OLD");
    const bad = { ...snapshot([player(1)]), warnings: [1n as unknown as string] };
    expect(() => writeSnapshotAtomically(target, bad)).toThrow();
    expect(readFileSync(target, "utf8")).toBe("OLD");
    writeSnapshotAtomically(target, snapshot([player(1)]));
    expect(JSON.parse(readFileSync(target, "utf8")).version).toBe(SNAPSHOT_VERSION);
    expect(existsSync(target + ".tmp")).toBe(false);
  });
});

describe("buildSnapshotFrom warnings", () => {
  it("carries the parser's version warning and adds the sanity warning", () => {
    const db = Buffer.alloc(2000);
    db.writeUInt32LE(10, 300); // club row head: owner
    db.writeUInt32LE(100, 318); // club uid
    const tactics = Buffer.alloc(29);
    tactics.writeUInt32LE(50, 19);
    const parsed = {
      name: "x", formatVersion: "24.4.1+0", gameDate: "2025-04-06", db,
      clubs: [{ id: 10, uid: 100, name: "C", shortName: "C", nation: 1, offset: 0 }],
      teams: [{ offset: 300, club: null, ordinal: 49, type: 100, members: [] }],
      players: [{
        id: 5, uid: 50, name: "Ann", fullName: "Ann", age: 20, birthDate: "2005-01-02", nationId: 1, otherNationIds: [],
        clubId: 10, club: "C", team: 50, ca: 1, pa: 1, positions: [], positionRatings: Array(15).fill(1), attributes: {},
        rawAttributes: [], source: { person: 10, ability: 100, identity: 200 },
      }],
      diagnostics: {}, warnings: ["Save format 24.4.1+0 differs from the supported build 24.3.0+0; offsets may have moved."],
    } as unknown as ParsedSave;
    const s = buildSnapshotFrom(parsed, tactics, "x.fm");
    const w = s.warnings.join("\n");
    expect(w).toContain("24.4.1+0");
    expect(w).toContain("first team has 1 players");
    expect(s.squads.first.map((p) => p.uid)).toEqual([50]);
    expect(s.squads.reserves).toEqual([]);
  });
});
