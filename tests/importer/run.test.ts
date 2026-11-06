import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSnapshot } from "../../src/shared/snapshot.ts";
import { findSampleSave } from "../helpers/sample.ts";

const SAVE = findSampleSave();

function runImporter(save: string, out: string) {
  const t = Date.now();
  const r = spawnSync(process.execPath, ["--max-old-space-size=4096", "src/importer/run.ts", save, out], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const lines = r.stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { type: string; code?: string; message?: string });
  return { status: r.status, lines, last: lines[lines.length - 1], elapsedMs: Date.now() - t };
}
const sha256 = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
const tmp = () => mkdtempSync(join(tmpdir(), "fm-run-"));

describe("importer process", () => {
  it("reports NOT_A_SAVE for a missing file and writes no output", () => {
    const out = join(tmp(), "snapshot.json");
    const r = runImporter(join(tmp(), "missing.fm"), out);
    expect([r.status, r.last.type, r.last.code]).toEqual([1, "error", "NOT_A_SAVE"]);
    expect(existsSync(out)).toBe(false);
  });
  it("reports NOT_A_SAVE for a text file renamed to .fm and writes no output", () => {
    const d = tmp();
    const fake = join(d, "fake.fm");
    writeFileSync(fake, "this is not a football manager save, just some text that is long enough");
    const out = join(d, "snapshot.json");
    const r = runImporter(fake, out);
    expect([r.status, r.last.type, r.last.code]).toEqual([1, "error", "NOT_A_SAVE"]);
    expect(existsSync(out)).toBe(false);
  });
});

describe.skipIf(!SAVE)("importer process on the sample save", () => {
  it("exits 0 with a valid snapshot in under 120 s and leaves the save untouched", async () => {
    const before = { size: statSync(SAVE!).size, mtime: statSync(SAVE!).mtimeMs, hash: await sha256(SAVE!) };
    const out = join(tmp(), "snapshot.json");
    const r = runImporter(SAVE!, out);
    expect(r.status).toBe(0);
    expect(r.last.type).toBe("done");
    expect(r.lines.some((l) => l.type === "progress")).toBe(true);
    expect(isSnapshot(JSON.parse(readFileSync(out, "utf8")))).toBe(true);
    expect(r.elapsedMs).toBeLessThan(120_000);
    expect({ size: statSync(SAVE!).size, mtime: statSync(SAVE!).mtimeMs, hash: await sha256(SAVE!) }).toEqual(before);
  });
});
