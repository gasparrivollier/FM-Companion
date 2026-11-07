import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { defaultOwnerData, type OwnerData } from "../../src/planner/domain/ownerData.ts";
import { blankSlots, PRESETS } from "../../src/planner/domain/tactics.ts";
import { memoryStorage, type OwnerStorage } from "../../src/planner/state/storage.ts";
import { App } from "../../src/planner/ui/App.tsx";
import { SNAPSHOT_VERSION, type Snapshot, type SnapshotPlayer } from "../../src/shared/snapshot.ts";

export const spyStorage = (data?: OwnerData): OwnerStorage & { write: ReturnType<typeof vi.fn> } => {
  const inner = memoryStorage(data ? JSON.stringify(data) : undefined);
  return { read: () => inner.read(), write: vi.fn((t: string) => inner.write(t)) };
};

export function snapshotWith(squads: { first: SnapshotPlayer[]; reserves?: SnapshotPlayer[]; u18?: SnapshotPlayer[] }, gameDate = "2025-04-06"): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "x.fm", gameVersion: "24.3.0+0", gameDate, importedAt: "now", importerVersion: "1", club: { id: 1, uid: 2, name: "Club Test", nationOrdinal: 1 } },
    squads: { first: squads.first, reserves: squads.reserves ?? [], u18: squads.u18 ?? [] }, warnings: [],
  };
}

export async function openApp(snapshot: Snapshot, data?: OwnerData) {
  const storage = spyStorage(data);
  render(<App source={{ load: async () => snapshot }} storage={storage} />);
  await screen.findByRole("group", { name: "Temporada del plan" });
  return storage;
}

export const planWith = (assign: (slots: ReturnType<typeof blankSlots>) => void, season = 2025): OwnerData => {
  const d = defaultOwnerData();
  const slots = blankSlots(PRESETS[0].slots);
  assign(slots);
  d.plans[season] = { tacticId: "442", slots, dirty: false };
  return d;
};
