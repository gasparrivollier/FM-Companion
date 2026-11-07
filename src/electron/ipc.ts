// The handlers behind `window.fm`. No `electron` import: main.ts passes in ipcMain and the dialog functions.
import type { ImportResult } from "./api.ts";
import { ownerFile, readSnapshotFile, snapshotPath } from "./files.ts";
import type { ImportRunner, RunnerOptions } from "./importRunner.ts";

interface IpcLike {
  handle(channel: string, fn: (event: any, ...args: any[]) => unknown): void;
  on(channel: string, fn: (event: { returnValue?: unknown }, ...args: any[]) => void): void;
}
export interface IpcDeps {
  dir: string;
  runner: ImportRunner;
  pickSave(): Promise<string | null>;
  openFolder(dir: string): Promise<void>;
  sendProgress(percent: number, message: string): void;
  now?: () => Date;
}

const str = (x: unknown, what: string): string => {
  if (typeof x !== "string") throw new TypeError(`${what} must be a string`);
  return x;
};

export function registerIpc(ipc: IpcLike, deps: IpcDeps): void {
  const owner = ownerFile(deps.dir);
  ipc.handle("owner:read", () => { const r = owner.read(); return r.kind === "ok" ? r.text : null; });
  ipc.handle("owner:write", (_e, text) => { owner.write(str(text, "text")); });
  ipc.on("owner:writeSync", (e, text) => {
    try { owner.write(str(text, "text")); e.returnValue = true; } catch { e.returnValue = false; }
  });
  ipc.handle("owner:openFolder", () => deps.openFolder(deps.dir));
  ipc.handle("owner:backupAndReset", () => owner.backupAndReset((deps.now ?? (() => new Date()))()));
  ipc.handle("snapshot:read", () => readSnapshotFile(deps.dir));
  ipc.handle("importer:pickSave", () => deps.pickSave());
  ipc.handle("importer:start", (_e, path): Promise<ImportResult> => deps.runner.start(str(path, "path"), deps.sendProgress));
  ipc.handle("importer:cancel", () => { deps.runner.cancel(); });
}

/** Electron runs as plain Node for the importer; the heap flag is the same one the CLI uses. */
export function importerOptions(dir: string, importerPath: string): RunnerOptions {
  return {
    command: process.execPath,
    args: ["--max-old-space-size=4096", importerPath],
    env: { ELECTRON_RUN_AS_NODE: "1" },
    outPath: snapshotPath(dir),
    timeoutMs: 10 * 60_000,
  };
}

/** Asks the renderer to flush before the window closes, and waits for its acknowledgement (or a timeout). */
export function createCloseGate(sendFlush: () => void, timeoutMs: number): { request(): Promise<void>; ack(): void } {
  let release: (() => void) | null = null;
  return {
    request() {
      return new Promise<void>((resolve) => {
        const t = setTimeout(done, timeoutMs);
        function done() { clearTimeout(t); release = null; resolve(); }
        release = done;
        sendFlush();
      });
    },
    ack() { release?.(); },
  };
}

