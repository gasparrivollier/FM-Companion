// Imports a save through the same runner the app uses and reports counts. Used by `npm run electron:smoke` (inside Electron).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSnapshotFile } from "./files.ts";
import { createImportRunner } from "./importRunner.ts";
import { importerOptions } from "./ipc.ts";

export async function runSmoke(savePath: string, importerPath: string): Promise<{ code: number; line: string }> {
  const dir = mkdtempSync(join(tmpdir(), "fm-smoke-"));
  const t0 = Date.now();
  const r = await createImportRunner(importerOptions(dir, importerPath)).start(savePath, () => {});
  if (!r.ok) return { code: 1, line: JSON.stringify({ ok: false, code: r.code, message: r.message }) };
  const snap = readSnapshotFile(dir) as { squads: Record<"first" | "reserves" | "u18", unknown[]> };
  const n = (k: "first" | "reserves" | "u18") => snap.squads[k].length;
  const out = { ok: true, first: n("first"), reserves: n("reserves"), u18: n("u18"), players: n("first") + n("reserves") + n("u18"), ms: Date.now() - t0, node: process.versions.node, electron: process.versions.electron ?? null };
  return { code: 0, line: JSON.stringify(out) };
}
