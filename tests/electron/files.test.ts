import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { ownerFile, readSnapshotFile, snapshotPath, writeFileAtomic } from "../../src/electron/files.ts";

const dir = (name = "fm-files-") => mkdtempSync(join(tmpdir(), name));
const good = (team: string) => JSON.stringify({ ...defaultOwnerData(), settings: { ...defaultOwnerData().settings, team } });

describe("writeFileAtomic", () => {
  it("replaces the content and leaves only the target in the folder", () => {
    const d = dir();
    writeFileSync(join(d, "a.json"), "old");
    writeFileAtomic(join(d, "a.json"), "new");
    expect(readFileSync(join(d, "a.json"), "utf8")).toBe("new");
    expect(readdirSync(d)).toEqual(["a.json"]);
  });
  it("when the rename fails the target is untouched and no temporary file is left", () => {
    const d = dir();
    const target = join(d, "a.json");
    mkdirSync(target);
    writeFileSync(join(target, "keep.txt"), "x");
    expect(() => writeFileAtomic(target, "new")).toThrow();
    expect(readdirSync(d)).toEqual(["a.json"]);
    expect(readdirSync(target)).toEqual(["keep.txt"]);
  });
});

describe("ownerFile", () => {
  it("reads missing as missing and a present file as ok", () => {
    const d = dir();
    const f = ownerFile(d);
    expect(f.read()).toEqual({ kind: "missing" });
    f.write(good("A"));
    expect(f.read()).toEqual({ kind: "ok", text: good("A") });
  });
  it("ignores a stale temporary file from a crash and cleans it on the next write", () => {
    const d = dir();
    const f = ownerFile(d);
    f.write(good("A"));
    writeFileSync(join(d, "owner.json.tmp"), "half writ");
    expect(f.read()).toEqual({ kind: "ok", text: good("A") });
    f.write(good("B"));
    expect(readdirSync(d).sort()).toEqual(["owner.json", "owner.json.bak"]);
  });
  it("keeps the previous good document as .bak, and not a corrupt one", () => {
    const d = dir();
    const f = ownerFile(d);
    f.write(good("A"));
    f.write(good("B"));
    expect(readFileSync(join(d, "owner.json.bak"), "utf8")).toBe(good("A"));
    writeFileSync(join(d, "owner.json"), "{"); // corrupted outside the app
    f.write(good("C"));
    expect(readFileSync(join(d, "owner.json.bak"), "utf8")).toBe(good("A"));
    expect(readFileSync(join(d, "owner.json"), "utf8")).toBe(good("C"));
  });
  it("backupAndReset copies first, then removes owner.json", () => {
    const d = dir();
    const f = ownerFile(d);
    writeFileSync(join(d, "owner.json"), "{broken");
    const { backupPath } = f.backupAndReset(new Date(2026, 10, 7, 22, 15, 30));
    expect(backupPath).toBe(join(d, "owner-backup-20261107-221530.json"));
    expect(readFileSync(backupPath, "utf8")).toBe("{broken");
    expect(existsSync(join(d, "owner.json"))).toBe(false);
  });
  it("backupAndReset refuses, leaving owner.json in place, if the copy cannot be made", () => {
    const d = dir();
    const f = ownerFile(d);
    writeFileSync(join(d, "owner.json"), "{broken");
    mkdirSync(join(d, "owner-backup-20261107-221530.json")); // the copy's destination is taken by a folder
    expect(() => f.backupAndReset(new Date(2026, 10, 7, 22, 15, 30))).toThrow();
    expect(readFileSync(join(d, "owner.json"), "utf8")).toBe("{broken");
  });
  it("a reset keeps the last good document too: the .bak is not lost to the next writes", () => {
    const d = dir();
    const f = ownerFile(d);
    f.write(good("A"));
    f.write(good("B")); // .bak = A
    writeFileSync(join(d, "owner.json"), ""); // damaged outside the app
    const { backupPath } = f.backupAndReset(new Date(2026, 10, 7, 22, 15, 30));
    f.write(good("fresh1"));
    f.write(good("fresh2")); // .bak is now fresh data
    expect(readFileSync(join(d, "owner.json.bak"), "utf8")).toBe(good("fresh1"));
    const kept = readdirSync(d).filter((n) => n.startsWith("owner-backup-")).map((n) => readFileSync(join(d, n), "utf8"));
    expect(kept).toContain(good("A"));
    expect(backupPath).toContain("owner-backup-20261107-221530");
  });
  it("works in a folder with spaces and accents", () => {
    const d = join(dir("fm files "), "Gaspar Rivollier Canadá");
    const f = ownerFile(d);
    f.write(good("Ñandú"));
    expect(readFileSync(join(d, "owner.json"), "utf8")).toContain("Ñandú");
  });
});

describe("snapshot file", () => {
  it("throws NO_SNAPSHOT when missing and parses when present", () => {
    const d = dir();
    expect(() => readSnapshotFile(d)).toThrow("NO_SNAPSHOT");
    writeFileSync(snapshotPath(d), JSON.stringify({ a: 1 }));
    expect(readSnapshotFile(d)).toEqual({ a: 1 });
  });
});
