import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runSmoke } from "../../src/electron/smoke.ts";
import { findSampleSave } from "../helpers/sample.ts";

const lastJson = (stdout: string) => JSON.parse(stdout.trim().split("\n").at(-1)!);

describe("electron bundles", () => {
  beforeAll(() => { execFileSync(process.execPath, ["scripts/build-electron.mjs"], { stdio: "ignore" }); });

  it("builds the three files", () => {
    for (const f of ["main.cjs", "preload.cjs", "importer.cjs"]) expect(existsSync(join("dist-electron", f))).toBe(true);
  });
  it("the importer bundle reports NOT_A_SAVE for a missing file and exits 1", () => {
    const out = join(mkdtempSync(join(tmpdir(), "fm bundle ")), "snapshot.json");
    const r = spawnSync(process.execPath, ["dist-electron/importer.cjs", join(tmpdir(), "no-such-save.fm"), out], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(lastJson(r.stdout)).toMatchObject({ type: "error", code: "NOT_A_SAVE" });
  });
  it("the main bundle never uses a shell", () => {
    const main = readFileSync("dist-electron/main.cjs", "utf8");
    expect(main).not.toMatch(/shell:\s*(true|!0)/);
    expect(main).not.toMatch(/child_process[\w$]*\.(exec|execSync|execFile|execFileSync)\b/);
  });
  const save = findSampleSave();
  it.skipIf(!save)("the importer bundle imports the sample save with plain Node", () => {
    const out = join(mkdtempSync(join(tmpdir(), "fm bundle ñ ")), "snapshot.json");
    const r = spawnSync(process.execPath, ["--max-old-space-size=4096", "dist-electron/importer.cjs", save!, out], { encoding: "utf8", maxBuffer: 1 << 26 });
    expect(r.status).toBe(0);
    expect(lastJson(r.stdout)).toMatchObject({ type: "done" });
    const snap = JSON.parse(readFileSync(out, "utf8"));
    expect(snap.squads.first.length).toBeGreaterThan(15);
    if (existsSync("out/snapshot.json")) {
      const ref = JSON.parse(readFileSync("out/snapshot.json", "utf8"));
      expect(["first", "reserves", "u18"].map((k) => snap.squads[k].length)).toEqual(["first", "reserves", "u18"].map((k) => ref.squads[k].length));
    }
  });
  it.skipIf(!save)("runSmoke reports the counts through the same runner the app uses", async () => {
    const r = await runSmoke(save!, join("dist-electron", "importer.cjs"));
    expect(r.code).toBe(0);
    const o = JSON.parse(r.line);
    expect(o.ok).toBe(true);
    expect(o.players).toBe(o.first + o.reserves + o.u18);
  });
  it("runSmoke fails cleanly for a missing save", async () => {
    const r = await runSmoke(join(tmpdir(), "nope.fm"), join("dist-electron", "importer.cjs"));
    expect(r.code).toBe(1);
    expect(JSON.parse(r.line)).toMatchObject({ ok: false, code: "NOT_A_SAVE" });
  });
});
