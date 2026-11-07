import { describe, expect, it, vi } from "vitest";
import { proposePositions } from "../../src/planner/domain/positions.ts";
import { createWriteQueue } from "../../src/planner/state/writeQueue.ts";
import type { PositionCode } from "../../src/shared/snapshot.ts";

const CODES: PositionCode[] = ["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"];
const ratings = (o: Partial<Record<PositionCode, number>>) => Object.fromEntries(CODES.map((c) => [c, o[c] ?? 1])) as Record<PositionCode, number>;

describe("proposePositions edge cases", () => {
  it("does not throw on partial ratings and falls back to centre-back", () => {
    expect(proposePositions({ SW: 20 } as unknown as Record<PositionCode, number>)).toEqual({ natural: ["DFC"], covers: [] });
    expect(proposePositions({} as unknown as Record<PositionCode, number>)).toEqual({ natural: ["DFC"], covers: [] });
  });
  it("a sweeper whose other ratings are all low becomes a centre-back, not a goalkeeper", () => {
    expect(proposePositions(ratings({ SW: 20 }))).toEqual({ natural: ["DFC"], covers: [] });
  });
});

const deferred = () => { let resolve!: () => void; let reject!: (e: Error) => void; const promise = new Promise<void>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe("createWriteQueue", () => {
  it("runs writes one after another in call order even if the first finishes last", async () => {
    const d = [deferred(), deferred(), deferred()];
    const started: string[] = [];
    const done: string[] = [];
    const q = createWriteQueue(async (t) => { started.push(t); await d[started.length - 1].promise; done.push(t); });
    const ps = ["a", "b", "c"].map((t) => q.enqueue(t));
    await Promise.resolve();
    expect(started).toEqual(["a"]); // b and c wait for a
    d[0].resolve(); await ps[0];
    d[1].resolve(); await ps[1];
    d[2].resolve(); await ps[2];
    expect(started).toEqual(["a", "b", "c"]);
    expect(done).toEqual(["a", "b", "c"]);
  });
  it("a failed write rejects its own promise and does not block the next", async () => {
    const calls: string[] = [];
    const q = createWriteQueue(async (t) => { calls.push(t); if (t === "bad") throw new Error("disk full"); });
    const bad = q.enqueue("bad");
    const good = q.enqueue("good");
    await expect(bad).rejects.toThrow("disk full");
    await expect(good).resolves.toBeUndefined();
    expect(calls).toEqual(["bad", "good"]);
  });
  it("flushNow uses the synchronous writer when there is one, else enqueues", async () => {
    const write = vi.fn(async () => {});
    const writeSync = vi.fn();
    createWriteQueue(write, writeSync).flushNow("x");
    expect(writeSync).toHaveBeenCalledWith("x");
    expect(write).not.toHaveBeenCalled();
    const q2 = createWriteQueue(write);
    q2.flushNow("y");
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("y"));
  });
});
