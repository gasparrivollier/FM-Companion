// Builds the snapshot from a save. See docs/superpowers/specs/2026-11-06-fm24-companion-design.md section 6.3.
import { basename } from "node:path";
import { SNAPSHOT_VERSION, type PositionCode, type Snapshot, type SnapshotPlayer, type SquadKind } from "../shared/snapshot.ts";
import { readContracts, type ContractRecord } from "./contracts.ts";
import { ImportError } from "./errors.ts";
import { managedTeamFromTactics } from "./meta.ts";
import { homeGrownFrom, readRelations, type RelationEntry } from "./relations.ts";
import { SaveArchive } from "./savelens/archive.ts";
import { parseSave, type ParsedSave, type Player } from "./savelens/index.ts";
import { resolveManagedSquads } from "./squads.ts";

export const IMPORTER_VERSION = "1";
export const POSITION_CODES: readonly PositionCode[] =
  ["GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "ST", "WBL", "WBR"];

export interface BuildOptions { onProgress?: (percent: number, message: string) => void }

/** Height is the u16 at ability+84 (cm), weight the u16 at ability+82 (kg); 0 means unset. */
export function playerToSnapshot(p: Player, contract: ContractRecord | undefined, relations: RelationEntry[] | null, db: Buffer): SnapshotPlayer {
  const hg = homeGrownFrom(relations ?? []);
  const height = db.readUInt16LE(p.source.ability + 84);
  const weight = db.readUInt16LE(p.source.ability + 82);
  return {
    uid: p.uid,
    id: p.id,
    name: p.name,
    fullName: p.fullName,
    birthDate: p.birthDate,
    nationOrdinal: p.nationId,
    ca: p.ca,
    pa: p.pa,
    positionRatings: Object.fromEntries(POSITION_CODES.map((c, i) => [c, p.positionRatings[i]])) as Record<PositionCode, number>,
    attributes: { ...p.attributes },
    heightCm: height === 0 ? null : height,
    weightKg: weight === 0 ? null : weight,
    contract: contract
      ? {
          clubId: contract.clubId,
          wageGbpWeek: contract.wageGbpWeek,
          start: contract.start,
          end: contract.end,
          squadNumber: contract.squadNumber,
          squadStatusCode: contract.squadStatusCode,
        }
      : null,
    homeGrownClubs: hg.clubs,
    homeGrownNations: hg.nations,
  };
}

/** The part of the build that works on an already parsed save (also used by the integration tests to parse only once). */
export function buildSnapshotFrom(parsed: ParsedSave, tactics: Buffer, saveFileName: string, options: BuildOptions = {}): Snapshot {
  const progress = options.onProgress ?? (() => {});
  const { teamValue } = managedTeamFromTactics(tactics);
  const squads = resolveManagedSquads({ db: parsed.db, clubs: parsed.clubs, teams: parsed.teams, managedTeamValue: teamValue });
  progress(90, "Reading contracts");
  const contracts = readContracts(parsed.db, parsed.players.map((p) => ({ person: p.source.person, clubId: p.clubId })), parsed.gameDate);
  progress(96, "Building the squads");

  const kindOf = new Map<number, SquadKind>();
  for (const k of ["first", "reserves", "u18"] as SquadKind[]) {
    const v = squads.teamValues[k];
    if (v !== null) kindOf.set(v, k);
  }
  const out: Record<SquadKind, SnapshotPlayer[]> = { first: [], reserves: [], u18: [] };
  parsed.players.forEach((p, i) => {
    const kind = kindOf.get(p.team);
    if (!kind) return;
    out[kind].push(playerToSnapshot(p, contracts.get(i), readRelations(parsed.db, p.source.person, p.source.identity), parsed.db));
  });

  const warnings = [...parsed.warnings];
  if (squads.teamValues.reserves === null) warnings.push(`No Reservas team found for ${squads.club.name}.`);
  if (squads.teamValues.u18 === null) warnings.push(`No Sub-18 team found for ${squads.club.name}.`);
  const all = [...out.first, ...out.reserves, ...out.u18];
  const noContract = all.filter((p) => p.contract === null).length;
  const noEnd = all.filter((p) => p.contract !== null && p.contract.end === null).length;
  if (noContract) warnings.push(`${noContract} players without a current contract.`);
  if (noEnd) warnings.push(`${noEnd} contracts without an end date.`);

  progress(100, "Done");
  return {
    version: SNAPSHOT_VERSION,
    meta: {
      saveFileName,
      gameVersion: parsed.formatVersion,
      gameDate: parsed.gameDate,
      importedAt: new Date().toISOString(),
      importerVersion: IMPORTER_VERSION,
      club: squads.club,
    },
    squads: out,
    warnings,
  };
}

export function buildSnapshot(savePath: string, options: BuildOptions = {}): Snapshot {
  const parsed = parseSave(savePath, options.onProgress);
  let tactics: Buffer;
  const a = new SaveArchive(savePath);
  try {
    tactics = a.member("tactics_man.dat");
  } catch {
    throw new ImportError("NO_MANAGED_CLUB", "The save has no tactics_man.dat, so the managed club cannot be found.");
  } finally {
    a.close();
  }
  return buildSnapshotFrom(parsed, tactics, basename(savePath), options);
}
