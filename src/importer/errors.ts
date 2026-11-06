export type ImportErrorCode = "NOT_A_SAVE" | "UNSUPPORTED_VERSION" | "TRUNCATED" | "NO_MANAGED_CLUB" | "OUT_OF_MEMORY"
  | "SAVE_CHANGED" | "UNSUPPORTED_SAVE" | "OUTPUT_FAILED" | "INTERNAL";

export class ImportError extends Error {
  code: ImportErrorCode;
  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
