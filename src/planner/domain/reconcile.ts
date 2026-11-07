import type { Snapshot, SquadKind } from "../../shared/snapshot.ts";
import type { OwnerData } from "./ownerData.ts";
import { baseSeason } from "./season.ts";
import { buildPlayer, type PlannerPlayer } from "./squad.ts";

/** Every uid referenced by any plan (titular or depth). */
export function plannedUids(data: OwnerData): Set<number> {
  const out = new Set<number>();
  for (const plan of Object.values(data.plans)) {
    for (const s of plan.slots) {
      if (s.uid !== null) out.add(s.uid);
      for (const u of s.alt) if (u !== null) out.add(u);
    }
  }
  return out;
}

/**
 * Applies a new snapshot to the owner's data. Nothing the owner made is ever deleted: a planned player who is no longer in
 * the snapshot stays in the plans and is reported in `left`. Marks are applied over the imported proposal.
 */
export function reconcile(data: OwnerData, snap: Snapshot): { data: OwnerData; players: PlannerPlayer[]; left: number[]; season: number } {
  const players: PlannerPlayer[] = [];
  const seen = new Set<number>();
  for (const kind of ["first", "reserves", "u18"] as SquadKind[]) {
    for (const p of snap.squads[kind]) {
      if (seen.has(p.uid)) continue;
      seen.add(p.uid);
      players.push(buildPlayer(p, kind, data.marks[p.uid]));
    }
  }
  const planned = plannedUids(data);
  const known = { ...data.known };
  for (const p of players) if (planned.has(p.uid)) known[p.uid] = { name: p.name };
  const left = [...planned].filter((u) => !seen.has(u)).sort((a, b) => a - b);
  const season = baseSeason(data, snap.meta.gameDate);
  return { data: { ...data, known, lastSeason: season }, players, left, season };
}
