// Process entry: node --max-old-space-size=4096 src/importer/run.ts <savePath> <outPath>
// stdout carries ONLY JSON lines: {"type":"progress",percent,message} ... then {"type":"done",outPath,warnings} or {"type":"error",code,message}.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildSnapshot } from "./snapshot.ts";
import { ImportError, toImportError, writeSnapshotAtomically } from "./validate.ts";

const emit = (o: Record<string, unknown>) => process.stdout.write(JSON.stringify(o) + "\n");

try {
  const [, , savePath, outPath] = process.argv;
  if (!savePath || !outPath) throw new ImportError("INTERNAL", "usage: run.ts <savePath> <outPath>");
  try {
    mkdirSync(dirname(outPath), { recursive: true });
  } catch (e) {
    throw new ImportError("OUTPUT_FAILED", `Cannot create the output folder: ${(e as Error).message}`);
  }
  const snapshot = buildSnapshot(savePath, { onProgress: (percent, message) => emit({ type: "progress", percent, message }) });
  try {
    writeSnapshotAtomically(outPath, snapshot);
  } catch (e) {
    throw new ImportError("OUTPUT_FAILED", `Cannot write the snapshot: ${(e as Error).message}`);
  }
  emit({ type: "done", outPath, warnings: snapshot.warnings });
} catch (e) {
  const err = toImportError(e);
  emit({ type: "error", code: err.code, message: err.message });
  process.exitCode = 1;
}
