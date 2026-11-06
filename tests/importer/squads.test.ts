import { describe, expect, it } from "vitest";
import { resolveManagedSquads, teamHeadOf } from "../../src/importer/squads.ts";
import { ImportError } from "../../src/importer/errors.ts";
import type { Club } from "../../src/importer/savelens/clubs.ts";
import type { Team } from "../../src/importer/savelens/teams.ts";

const club = (id: number, uid: number, nation = 5): Club => ({ id, uid, name: `Club ${id}`, shortName: `C${id}`, nation, offset: 0 });

/** A synthetic database: each team head has owner u32 @0 and uid u32 @18; teams are 100 bytes apart. */
function world(heads: { ordinal: number; type: number; owner: number; uid: number }[]) {
  const db = Buffer.alloc(100 * (heads.length + 1));
  const teams: Team[] = heads.map((h, i) => {
    const offset = 100 * i + 10;
    db.writeUInt32LE(h.owner, offset);
    db.writeUInt32LE(h.uid, offset + 18);
    return { offset, club: null, ordinal: h.ordinal, type: h.type, members: [] };
  });
  return { db, teams };
}

describe("teamHeadOf", () => {
  it("reads owner at +0 and team uid at +18", () => {
    const { db, teams } = world([{ ordinal: 9, type: 100, owner: 1123, uid: 2000341187 }]);
    expect(teamHeadOf(db, teams[0].offset)).toEqual({ owner: 1123, uid: 2000341187 });
  });
});

describe("resolveManagedSquads", () => {
  const clubs = [club(10, 100, 167), club(12, 120)];
  const full = [
    { ordinal: 49, type: 100, owner: 10, uid: 100 }, // the club's own row: ordinal = managed team value - 1
    { ordinal: 900, type: 100, owner: 11, uid: 2_000_000_001 }, // Reservas (owner = club id + 1)
    { ordinal: 901, type: 21, owner: 11, uid: 2_000_000_002 }, // another created team: not a squad
    { ordinal: 902, type: 18, owner: 11, uid: 2_000_000_003 }, // Sub-18
    { ordinal: 950, type: 100, owner: 11, uid: 2_000_000_009 }, // a later type-100 team is ignored
    { ordinal: 903, type: 18, owner: 13, uid: 2_000_000_004 }, // another club's Sub-18
  ];
  it("finds the club from the managed team value and its Reservas and Sub-18 teams", () => {
    const { db, teams } = world(full);
    expect(resolveManagedSquads({ db, clubs, teams, managedTeamValue: 50 })).toEqual({
      club: { id: 10, uid: 100, name: "Club 10", nationOrdinal: 167 },
      teamValues: { first: 50, reserves: 900, u18: 902 },
    });
  });
  it("returns null for a missing Reservas or Sub-18 team", () => {
    const { db, teams } = world([full[0], full[3]]);
    expect(resolveManagedSquads({ db, clubs, teams, managedTeamValue: 50 }).teamValues).toEqual({ first: 50, reserves: null, u18: 902 });
    const w = world([full[0]]);
    expect(resolveManagedSquads({ db: w.db, clubs, teams: w.teams, managedTeamValue: 50 }).teamValues)
      .toEqual({ first: 50, reserves: null, u18: null });
  });
  it("throws NO_MANAGED_CLUB when no club row matches", () => {
    const { db, teams } = world(full);
    expect(() => resolveManagedSquads({ db, clubs, teams, managedTeamValue: 777 })).toThrow(ImportError);
  });
});
