import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ImportResult } from "../../src/electron/api.ts";
import { createCloseGate, importerOptions, registerIpc } from "../../src/electron/ipc.ts";
import type { ImportRunner } from "../../src/electron/importRunner.ts";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";

type Fn = (event: { returnValue?: unknown }, ...a: any[]) => any;
function fakeIpc() {
  const handlers = new Map<string, Fn>();
  const listeners = new Map<string, Fn>();
  return {
    handle: (c: string, f: Fn) => { handlers.set(c, f); },
    on: (c: string, f: Fn) => { listeners.set(c, f); },
    invoke: async (c: string, ...a: any[]) => handlers.get(c)!({}, ...a),
    send: (c: string, ...a: any[]) => { const ev: { returnValue?: unknown } = {}; listeners.get(c)!(ev, ...a); return ev.returnValue; },
  };
}
const doc = (team: string) => JSON.stringify({ ...defaultOwnerData(), settings: { ...defaultOwnerData().settings, team } });

function setup(runner?: Partial<ImportRunner>) {
  const dir = mkdtempSync(join(tmpdir(), "fm ipc á "));
  const ipc = fakeIpc();
  const progress: [number, string][] = [];
  const picked = { value: "C:\\saves\\x.fm" as string | null };
  const opened: string[] = [];
  const r: ImportRunner = {
    running: () => false, cancel: vi.fn(),
    start: vi.fn(async (_p: string, cb: (n: number, m: string) => void): Promise<ImportResult> => { cb(40, "Leyendo"); return { ok: true, warnings: ["w"] }; }),
    ...runner,
  };
  registerIpc(ipc, { dir, runner: r, pickSave: async () => picked.value, openFolder: async (d) => { opened.push(d); }, sendProgress: (p, m) => progress.push([p, m]), now: () => new Date(2026, 10, 7, 1, 2, 3) });
  return { dir, ipc, r, progress, picked, opened };
}

describe("registerIpc", () => {
  it("owner:write then owner:read round-trips through the file, and writeSync is synchronous", async () => {
    const { ipc, dir } = setup();
    expect(await ipc.invoke("owner:read")).toBeNull();
    await ipc.invoke("owner:write", doc("A"));
    expect(await ipc.invoke("owner:read")).toBe(doc("A"));
    expect(ipc.send("owner:writeSync", doc("B"))).toBe(true);
    expect(readFileSync(join(dir, "owner.json"), "utf8")).toBe(doc("B"));
  });
  it("owner:backupAndReset copies first and returns the path; openFolder opens the data folder", async () => {
    const { ipc, dir, opened } = setup();
    writeFileSync(join(dir, "owner.json"), "{broken");
    const r = await ipc.invoke("owner:backupAndReset");
    expect(readFileSync(r.backupPath, "utf8")).toBe("{broken");
    await ipc.invoke("owner:openFolder");
    expect(opened).toEqual([dir]);
  });
  it("snapshot:read returns the parsed file, and throws NO_SNAPSHOT when there is none", async () => {
    const { ipc, dir } = setup();
    await expect(ipc.invoke("snapshot:read")).rejects.toThrow("NO_SNAPSHOT");
    writeFileSync(join(dir, "snapshot.json"), JSON.stringify({ a: 1 }));
    expect(await ipc.invoke("snapshot:read")).toEqual({ a: 1 });
  });
  it("importer:start forwards progress and returns the runner's result; pickSave returns the dialog's answer", async () => {
    const { ipc, r, progress, picked } = setup();
    expect(await ipc.invoke("importer:pickSave")).toBe("C:\\saves\\x.fm");
    picked.value = null;
    expect(await ipc.invoke("importer:pickSave")).toBeNull();
    expect(await ipc.invoke("importer:start", "C:\\saves\\Canadá.fm")).toEqual({ ok: true, warnings: ["w"] });
    expect(r.start).toHaveBeenCalledWith("C:\\saves\\Canadá.fm", expect.any(Function));
    expect(progress).toEqual([[40, "Leyendo"]]);
  });
  it("importer:cancel cancels the runner", async () => {
    const { ipc, r } = setup();
    await ipc.invoke("importer:cancel");
    expect(r.cancel).toHaveBeenCalled();
  });
  it("rejects arguments that are not strings", async () => {
    const { ipc } = setup();
    await expect(ipc.invoke("owner:write", { x: 1 })).rejects.toThrow(TypeError);
    await expect(ipc.invoke("importer:start", 42)).rejects.toThrow(TypeError);
    expect(ipc.send("owner:writeSync", 5)).toBe(false);
  });
});

describe("importerOptions", () => {
  it("runs Electron as Node with the heap flag, and writes the snapshot into the data folder", () => {
    const o = importerOptions("C:\\Datos", "C:\\app\\importer.cjs");
    expect(o.env).toMatchObject({ ELECTRON_RUN_AS_NODE: "1" });
    expect(o.args).toEqual(["--max-old-space-size=4096", "C:\\app\\importer.cjs"]);
    expect(o.outPath).toBe(join("C:\\Datos", "snapshot.json"));
    expect(o.command).toBe(process.execPath);
    expect(o.timeoutMs).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

describe("createCloseGate", () => {
  it("resolves when the renderer acknowledges, or after the timeout", async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const gate = createCloseGate(send, 1500);
    const p1 = gate.request();
    expect(send).toHaveBeenCalledTimes(1);
    gate.ack();
    await expect(p1).resolves.toBeUndefined();
    const p2 = gate.request();
    let done = false;
    p2.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(1400);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
