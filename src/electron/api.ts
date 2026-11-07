import type { ImportErrorCode } from "../importer/errors.ts";

export type ImportFailureCode = ImportErrorCode | "CANCELLED" | "CRASHED" | "BUSY";
export type ImportResult = { ok: true; warnings: string[] } | { ok: false; code: ImportFailureCode; message: string };

/** The bridge the preload exposes as `window.fm`. Every method maps to one IPC channel in ipc.ts. */
export interface FmApi {
  owner: {
    read(): Promise<string | null>;
    write(text: string): Promise<void>;
    writeSync(text: string): void;
    openFolder(): Promise<void>;
    backupAndReset(): Promise<{ backupPath: string }>;
  };
  snapshot: { read(): Promise<unknown> };
  importer: {
    pickSave(): Promise<string | null>;
    start(savePath: string): Promise<ImportResult>;
    cancel(): Promise<void>;
    onProgress(cb: (percent: number, message: string) => void): () => void;
  };
  lifecycle: {
    /** The window is closing: flush what is pending, then call `ack()`. */
    onBeforeClose(cb: () => void): () => void;
    ack(): void;
  };
}
