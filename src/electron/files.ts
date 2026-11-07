// File layer of the main process. No `electron` import: everything here is tested in plain Node.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseOwnerData } from "../planner/domain/ownerData.ts";

/** Writes to a temporary file in the same folder, then renames. On any failure the target is untouched and no temporary is left. */
export function writeFileAtomic(path: string, text: string): void {
  const tmp = path + ".tmp";
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

export function snapshotPath(dir: string): string {
  return join(dir, "snapshot.json");
}
export function readSnapshotFile(dir: string): unknown {
  const p = snapshotPath(dir);
  if (!existsSync(p)) throw new Error("NO_SNAPSHOT");
  return JSON.parse(readFileSync(p, "utf8"));
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

export type OwnerRead = { kind: "missing" } | { kind: "ok"; text: string };
export interface OwnerFile {
  path: string;
  read(): OwnerRead;
  write(text: string): void;
  backupAndReset(now: Date): { backupPath: string };
}

/**
 * The owner's data file. It is only ever replaced atomically; the last good document is kept as owner.json.bak; a reset
 * copies the file to a timestamped name first and refuses if that copy fails.
 */
export function ownerFile(dir: string): OwnerFile {
  const path = join(dir, "owner.json");
  return {
    path,
    read() {
      return existsSync(path) ? { kind: "ok", text: readFileSync(path, "utf8") } : { kind: "missing" };
    },
    write(text) {
      mkdirSync(dir, { recursive: true });
      if (existsSync(path)) {
        const current = readFileSync(path, "utf8");
        if (parseOwnerData(current).ok) copyFileSync(path, path + ".bak");
      }
      writeFileAtomic(path, text);
    },
    backupAndReset(now) {
      if (!existsSync(path)) throw new Error("NO_OWNER_FILE");
      const backupPath = join(dir, `owner-backup-${stamp(now)}.json`);
      copyFileSync(path, backupPath);
      unlinkSync(path);
      return { backupPath };
    },
  };
}
