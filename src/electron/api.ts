import type { ImportErrorCode } from "../importer/errors.ts";

export type ImportFailureCode = ImportErrorCode | "CANCELLED" | "CRASHED" | "BUSY";
export type ImportResult = { ok: true; warnings: string[] } | { ok: false; code: ImportFailureCode; message: string };
