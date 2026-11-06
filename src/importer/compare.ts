// uid-stability check: compares two snapshots of the same career. Identity = full name + date of birth.
// usage: node src/importer/compare.ts <snapshotA.json> <snapshotB.json>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isSnapshot, type Snapshot, type SnapshotPlayer } from "../shared/snapshot.ts";

export interface UidReport {
  common: number;
  sameIdentity: number;
  changedIdentity: { uid: number; a: string; b: string }[];
  onlyInA: number[];
  onlyInB: number[];
}

const everyone = (s: Snapshot): SnapshotPlayer[] => [...s.squads.first, ...s.squads.reserves, ...s.squads.u18];
const identity = (p: SnapshotPlayer) => `${p.fullName} ${p.birthDate}`;

export function compareSnapshots(a: Snapshot, b: Snapshot): UidReport {
  const ma = new Map(everyone(a).map((p) => [p.uid, identity(p)]));
  const mb = new Map(everyone(b).map((p) => [p.uid, identity(p)]));
  const report: UidReport = { common: 0, sameIdentity: 0, changedIdentity: [], onlyInA: [], onlyInB: [] };
  for (const [uid, ia] of ma) {
    const ib = mb.get(uid);
    if (ib === undefined) { report.onlyInA.push(uid); continue; }
    report.common++;
    if (ia === ib) report.sameIdentity++;
    else report.changedIdentity.push({ uid, a: ia, b: ib });
  }
  for (const uid of mb.keys()) if (!ma.has(uid)) report.onlyInB.push(uid);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , pa, pb] = process.argv;
  if (!pa || !pb) { console.error("usage: compare.ts <snapshotA.json> <snapshotB.json>"); process.exit(2); }
  const load = (p: string): Snapshot => {
    const x: unknown = JSON.parse(readFileSync(p, "utf8"));
    if (!isSnapshot(x)) throw new Error(`${p} is not a snapshot`);
    return x;
  };
  console.log(JSON.stringify(compareSnapshots(load(pa), load(pb)), null, 2));
}
