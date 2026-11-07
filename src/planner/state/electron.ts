import type { FmApi } from "../../electron/api.ts";
import type { ImporterPort, OwnerStorage, SnapshotSource } from "./storage.ts";

/** The Electron implementations of the planner's seams, over the preload bridge (`window.fm`). */
export function electronSnapshotSource(fm: FmApi): SnapshotSource {
  return { load: () => fm.snapshot.read() };
}
/** Writes are queued by the Planner itself; `writeSync` is what runs when the window is closing. */
export function electronOwnerStorage(fm: FmApi): OwnerStorage {
  return { read: () => fm.owner.read(), write: (t) => fm.owner.write(t), writeSync: (t) => fm.owner.writeSync(t) };
}
export function electronImporter(fm: FmApi): ImporterPort {
  return fm.importer;
}
