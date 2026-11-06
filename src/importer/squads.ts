// The managed club and the team values of its three squads. Rules: docs/03-data-dictionary.md section 5.
//
// Team head (found by the parser): owner u32 @0, ordinal u32 @14, team uid u32 @18.
// - A club's own row has owner = club id and uid = club uid; the club's MAIN team is the next row (ordinal + 1, uid + 1).
//   The managed team value (tactics_man.dat) is that main team's ordinal, so the club row has ordinal = value - 1.
// - Teams created by the game (uid >= 2,000,000,000) carry owner = club id + 1. Reservas = the lowest-ordinal type 100,
//   Sub-18 = the lowest-ordinal type 18. Only validated on Aberdeen (see docs/03 section 5.2).
import type { SnapshotMeta, SquadKind } from "../shared/snapshot.ts";
import { ImportError } from "./errors.ts";
import type { Club } from "./savelens/clubs.ts";
import type { Team } from "./savelens/teams.ts";

export interface ManagedSquads {
  club: SnapshotMeta["club"];
  teamValues: Record<SquadKind, number | null>;
}

const CREATED_UID_FLOOR = 2_000_000_000;

export function teamHeadOf(db: Buffer, offset: number): { owner: number; uid: number } {
  return { owner: db.readUInt32LE(offset), uid: db.readUInt32LE(offset + 18) };
}

export function resolveManagedSquads(args: { db: Buffer; clubs: Club[]; teams: Team[]; managedTeamValue: number }): ManagedSquads {
  const { db, clubs, teams, managedTeamValue } = args;
  const clubByUid = new Map(clubs.map((c) => [c.uid, c]));
  let club: Club | undefined;
  for (const t of teams) {
    if (t.ordinal !== managedTeamValue - 1) continue;
    club = clubByUid.get(teamHeadOf(db, t.offset).uid);
    if (club) break;
  }
  if (!club) throw new ImportError("NO_MANAGED_CLUB", `Could not find the club of the managed team (${managedTeamValue}).`);

  let reserves: number | null = null;
  let u18: number | null = null;
  for (const t of teams) {
    const h = teamHeadOf(db, t.offset);
    if (h.owner !== club.id + 1 || h.uid < CREATED_UID_FLOOR) continue;
    if (t.type === 100 && (reserves === null || t.ordinal < reserves)) reserves = t.ordinal;
    if (t.type === 18 && (u18 === null || t.ordinal < u18)) u18 = t.ordinal;
  }
  return {
    club: { id: club.id, uid: club.uid, name: club.name, nationOrdinal: club.nation },
    teamValues: { first: managedTeamValue, reserves, u18 },
  };
}
