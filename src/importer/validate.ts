// Sanity checks, error mapping and the atomic write of the snapshot.
import { renameSync, rmSync, writeFileSync } from "node:fs";
import type { Snapshot } from "../shared/snapshot.ts";
import { ImportError, type ImportErrorCode } from "./errors.ts";

export { ImportError };
export type { ImportErrorCode };

const FIRST_TEAM_SIZE = [15, 60] as const;
const WAGE_RANGE = [1, 500000] as const;
const AGE_RANGE = [14, 45] as const;

function ageOn(birth: string, date: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Plausibility checks run before an import is accepted. They warn; they never reject. */
export function sanityWarnings(s: Snapshot): string[] {
  const out: string[] = [];
  const n = s.squads.first.length;
  if (n < FIRST_TEAM_SIZE[0] || n > FIRST_TEAM_SIZE[1]) out.push(`The first team has ${n} players, which is unusual.`);
  const all = [...s.squads.first, ...s.squads.reserves, ...s.squads.u18];
  const badWage = all.filter((p) => p.contract && (p.contract.wageGbpWeek < WAGE_RANGE[0] || p.contract.wageGbpWeek > WAGE_RANGE[1])).length;
  if (badWage) out.push(`${badWage} players have a wage outside ${WAGE_RANGE[0]} to ${WAGE_RANGE[1]} pounds a week.`);
  const badAge = all.filter((p) => {
    const a = ageOn(p.birthDate, s.meta.gameDate);
    return a < AGE_RANGE[0] || a > AGE_RANGE[1];
  }).length;
  if (badAge) out.push(`${badAge} players have an age outside ${AGE_RANGE[0]} to ${AGE_RANGE[1]}.`);
  return out;
}

const DAMAGED = new Set(["TRUNCATED", "INVALID_MANIFEST", "INVALID_SIZE", "CORRUPT_COMPRESSION", "MISSING_DATABASE", "MISSING_MEMBER"]);

const UNREADABLE = new Set(["UNSUPPORTED_COMPRESSION", "UNSUPPORTED_DATE", "UNSUPPORTED_NAMES", "NO_PLAYERS", "AMBIGUOUS_IDENTITIES"]);

export function toImportError(e: unknown): ImportError {
  if (e instanceof ImportError) return e;
  const err = e as { code?: unknown; message?: unknown } | null;
  const code = typeof err?.code === "string" ? err.code : "";
  const message = typeof err?.message === "string" ? err.message : String(e);
  if (code === "UNSUPPORTED_VERSION") return new ImportError("UNSUPPORTED_VERSION", message);
  if (code === "UNSUPPORTED_FORMAT" || code === "ENOENT" || code === "EISDIR" || code === "EACCES") return new ImportError("NOT_A_SAVE", message);
  if (code === "SAVE_CHANGED") return new ImportError("SAVE_CHANGED", message);
  if (UNREADABLE.has(code)) return new ImportError("UNSUPPORTED_SAVE", message);
  if (DAMAGED.has(code)) return new ImportError("TRUNCATED", message);
  if (e instanceof RangeError && /allocation|array length|string length/i.test(message)) return new ImportError("OUT_OF_MEMORY", message);
  return new ImportError("INTERNAL", message);
}

/** Writes `<path>.tmp` and renames it over `path`; on any failure the target is untouched and no temporary file remains. */
export function writeSnapshotAtomically(path: string, s: Snapshot): void {
  const tmp = path + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify(s));
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
