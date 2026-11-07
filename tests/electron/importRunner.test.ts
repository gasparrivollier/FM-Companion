import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createImportRunner, describeFailure } from "../../src/electron/importRunner.ts";

const FAKE = join(import.meta.dirname, "..", "fixtures", "fake-importer.mjs");
const runner = (mode: string, extra: { timeoutMs?: number } = {}) =>
  createImportRunner({ command: process.execPath, args: [FAKE], env: { FAKE_MODE: mode }, outPath: "OUT.json", ...extra });

describe("importRunner", () => {
  it("forwards progress in order and returns the warnings on done", async () => {
    const seen: [number, string][] = [];
    const r = await runner("ok").start("save.fm", (p, m) => seen.push([p, m]));
    expect(seen).toEqual([[10, "Leyendo"], [50, "Resolviendo"]]);
    expect(r).toEqual({ ok: true, warnings: ["w1"] });
  });
  it("turns an error line into a Spanish message with its code", async () => {
    const r = await runner("error").start("save.fm", () => {});
    expect(r).toEqual({ ok: false, code: "NOT_A_SAVE", message: "Ese archivo no es un save de Football Manager 24." });
    const d = await runner("error-detail").start("save.fm", () => {});
    expect(d).toMatchObject({ ok: false, code: "INTERNAL" });
    expect((d as { message: string }).message).toContain("boom");
  });
  it("a child that exits without done or error is CRASHED, also when killed by a signal", async () => {
    expect(await runner("crash").start("s", () => {})).toMatchObject({ ok: false, code: "CRASHED" });
    expect(await runner("kill").start("s", () => {})).toMatchObject({ ok: false, code: "CRASHED" });
  });
  it("refuses a second start while one is running, then works again after it ends", async () => {
    const r = runner("hang");
    const first = r.start("s", () => {});
    expect(r.running()).toBe(true);
    expect(await r.start("s", () => {})).toMatchObject({ ok: false, code: "BUSY" });
    r.cancel();
    expect(await first).toMatchObject({ ok: false, code: "CANCELLED", message: "Importación cancelada." });
    expect(r.running()).toBe(false);
    const again = createImportRunner({ command: process.execPath, args: [FAKE], env: { FAKE_MODE: "ok" }, outPath: "o" });
    expect(await again.start("s", () => {})).toMatchObject({ ok: true });
  });
  it("parses output split mid-line, several lines in one chunk, and ignores noise", async () => {
    const seen: number[] = [];
    const r = await runner("split").start("s", (p) => seen.push(p));
    expect(seen).toEqual([30, 60]);
    expect(r).toMatchObject({ ok: true });
  });
  it("passes paths with spaces and accents through intact, as separate arguments", async () => {
    const save = "C:\\Users\\Gaspar Ñandú\\Documents\\Sports Interactive\\Theo Walcott - Aberdeen - Canadá.fm";
    const r = await createImportRunner({ command: process.execPath, args: [FAKE], env: { FAKE_MODE: "echo" }, outPath: "C:\\Datos de la app\\snapshot.json" }).start(save, () => {});
    expect(r).toEqual({ ok: true, warnings: [save, "C:\\Datos de la app\\snapshot.json"] });
  });
  it("kills a silent child after the timeout and reports CRASHED", async () => {
    const r = await runner("hang", { timeoutMs: 200 }).start("s", () => {});
    expect(r).toMatchObject({ ok: false, code: "CRASHED" });
  });
  it("reports a command that cannot be started as CRASHED", async () => {
    const r = await createImportRunner({ command: "no-such-binary-xyz", args: [], outPath: "o" }).start("s", () => {});
    expect(r).toMatchObject({ ok: false, code: "CRASHED" });
  });
});

describe("describeFailure", () => {
  it("has a Spanish text for every code", () => {
    const codes = ["NOT_A_SAVE", "UNSUPPORTED_VERSION", "TRUNCATED", "NO_MANAGED_CLUB", "OUT_OF_MEMORY", "SAVE_CHANGED", "UNSUPPORTED_SAVE", "OUTPUT_FAILED", "INTERNAL", "CANCELLED", "CRASHED", "BUSY"] as const;
    for (const c of codes) expect(describeFailure(c, "detalle").length).toBeGreaterThan(10);
    expect(describeFailure("CRASHED", "")).toContain("intactos");
    expect(describeFailure("SAVE_CHANGED", "")).toContain("Esperá");
  });
});
