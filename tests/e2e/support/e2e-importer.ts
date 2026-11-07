// Scripted stand-in for the importer, bundled into dist-e2e. Same stdout protocol as src/importer/run.ts.
// The "save" (argv[2]) is a small JSON file: { "squad": "A" | "B", "hang"?: true }.
import { readFileSync } from "node:fs";
import { writeSnapshotAtomically } from "../../../src/importer/validate.ts";
import { squadA, squadB } from "./squads.ts";

const emit = (o: Record<string, unknown>) => process.stdout.write(JSON.stringify(o) + "\n");
const [, , savePath, outPath] = process.argv;

try {
  const spec = JSON.parse(readFileSync(savePath, "utf8")) as { squad?: string; hang?: boolean };
  if (spec.squad !== "A" && spec.squad !== "B") throw new Error("unknown squad");
  emit({ type: "progress", percent: 10, message: "Leyendo" });
  if (spec.hang) {
    setInterval(() => {}, 1000); // never finishes: the test cancels it
  } else {
    emit({ type: "progress", percent: 60, message: "Resolviendo" });
    writeSnapshotAtomically(outPath, spec.squad === "A" ? squadA() : squadB());
    emit({ type: "done", outPath, warnings: [] });
  }
} catch {
  emit({ type: "error", code: "NOT_A_SAVE", message: "no es un save de prueba" });
  process.exitCode = 1;
}
