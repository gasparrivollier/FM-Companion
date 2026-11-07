import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import { createImportRunner } from "../../src/electron/importRunner.ts";
import { isSnapshot } from "../../src/shared/snapshot.ts";
import { squadA, squadB } from "../e2e/support/squads.ts";

let dir: string;
let bundle: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "fm-e2e-imp-"));
  bundle = join(dir, "importer.cjs");
  await build({ entryPoints: ["tests/e2e/support/e2e-importer.ts"], outfile: bundle, bundle: true, platform: "node", format: "cjs", target: "node24", logLevel: "silent" });
});

const run = (save: object | string, out: string) => {
  const savePath = join(dir, "save.fm");
  writeFileSync(savePath, typeof save === "string" ? save : JSON.stringify(save));
  const progress: number[] = [];
  const runner = createImportRunner({ command: process.execPath, args: [bundle], outPath: out, timeoutMs: 20000 });
  return { runner, progress, start: () => runner.start(savePath, (p) => progress.push(p)) };
};

describe("e2e squads and scripted importer", () => {
  it("both invented squads satisfy the snapshot contract and B differs from A by one leaver and one newcomer", () => {
    expect(isSnapshot(squadA())).toBe(true);
    expect(isSnapshot(squadB())).toBe(true);
    const a = squadA().squads.first.map((p) => p.uid);
    const b = squadB().squads.first.map((p) => p.uid);
    expect(a.filter((u) => !b.includes(u))).toEqual([9018]);
    expect(b.filter((u) => !a.includes(u))).toEqual([9101]);
  });
  it("writes squad A with progress and a snapshot that passes isSnapshot", async () => {
    const out = join(dir, "a.json");
    const r = run({ squad: "A" }, out);
    expect(await r.start()).toMatchObject({ ok: true });
    expect(r.progress.length).toBeGreaterThanOrEqual(2);
    expect(isSnapshot(JSON.parse(readFileSync(out, "utf8")))).toBe(true);
  });
  it("squad B writes the other squad", async () => {
    const out = join(dir, "b.json");
    await run({ squad: "B" }, out).start();
    expect(JSON.parse(readFileSync(out, "utf8")).squads.first.map((p: { uid: number }) => p.uid)).toContain(9101);
  });
  it("hang never finishes and can be cancelled without writing the output", async () => {
    const out = join(dir, "hang.json");
    const r = run({ squad: "B", hang: true }, out);
    const p = r.start();
    await new Promise((res) => setTimeout(res, 300));
    expect(r.runner.running()).toBe(true);
    r.runner.cancel();
    expect(await p).toMatchObject({ ok: false, code: "CANCELLED" });
    expect(() => readFileSync(out)).toThrow();
  });
  it("an unreadable save is NOT_A_SAVE", async () => {
    expect(await run("not json", join(dir, "x.json")).start()).toMatchObject({ ok: false, code: "NOT_A_SAVE" });
  });
});
