import { vi } from "vitest";
import type { FmApi, ImportResult } from "../../src/electron/api.ts";

export const NO_SNAPSHOT = new Error("Error invoking remote method 'snapshot:read': Error: NO_SNAPSHOT");

/** An in-memory stand-in for window.fm that the tests can drive. */
export function fakeFm(init: { owner?: string | null; snapshot?: unknown } = {}) {
  const s = {
    owner: init.owner ?? null as string | null,
    snapshot: init.snapshot ?? NO_SNAPSHOT as unknown,
    pick: "C:\\saves\\Canadá.fm" as string | null,
    startImpl: null as null | ((path: string) => Promise<ImportResult>),
    writes: [] as string[], syncWrites: [] as string[], resets: 0, acks: 0, opened: 0,
    progressCbs: [] as ((p: number, m: string) => void)[], closeCb: null as null | (() => void),
  };
  const fm: FmApi = {
    owner: {
      read: async () => s.owner,
      write: vi.fn(async (t: string) => { s.writes.push(t); s.owner = t; }),
      writeSync: vi.fn((t: string) => { s.syncWrites.push(t); s.owner = t; }),
      openFolder: vi.fn(async () => { s.opened++; }),
      backupAndReset: vi.fn(async () => { s.resets++; s.owner = null; return { backupPath: "C:\\Datos\\owner-backup-20261107-010203.json" }; }),
    },
    snapshot: { read: async () => { if (s.snapshot instanceof Error) throw s.snapshot; return s.snapshot; } },
    importer: {
      pickSave: vi.fn(async () => s.pick),
      start: vi.fn((path: string) => (s.startImpl ? s.startImpl(path) : Promise.resolve<ImportResult>({ ok: true, warnings: [] }))),
      cancel: vi.fn(async () => {}),
      onProgress: (cb) => { s.progressCbs.push(cb); return () => { s.progressCbs = s.progressCbs.filter((x) => x !== cb); }; },
    },
    lifecycle: { onBeforeClose: (cb) => { s.closeCb = cb; return () => { s.closeCb = null; }; }, ack: vi.fn(() => { s.acks++; }) },
  };
  return { fm, s, emit: (p: number, m: string) => s.progressCbs.forEach((c) => c(p, m)) };
}
