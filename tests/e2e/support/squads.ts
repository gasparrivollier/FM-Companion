// Invented squads for the e2e tests: no real people, no save content.
import { SNAPSHOT_VERSION, type PositionCode, type Snapshot, type SnapshotPlayer } from "../../../src/shared/snapshot.ts";

const CODES: PositionCode[] = ["GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "ST", "WBL", "WBR"];
const NAMES = ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Doce", "Trece", "Catorce", "Quince", "Dieciséis", "Diecisiete", "Dieciocho"];
const MAIN: PositionCode[] = ["GK", "GK", "DL", "DC", "DC", "DC", "DR", "DM", "MC", "MC", "ML", "MR", "AMC", "ST", "ST", "ST", "AML", "AMR"];

function player(uid: number, name: string, main: PositionCode, ca: number): SnapshotPlayer {
  return {
    uid, id: uid, name, fullName: name, birthDate: "2000-01-01", nationOrdinal: 1, ca, pa: ca + 10,
    positionRatings: Object.fromEntries(CODES.map((c) => [c, c === main ? 20 : 1])) as Record<PositionCode, number>,
    attributes: {}, heightCm: 180, weightKg: 75,
    contract: { clubId: 1, wageGbpWeek: 1000 + uid, start: "2024-07-01", end: "2027-06-30", squadNumber: null, squadStatusCode: null },
    homeGrownClubs: [], homeGrownNations: [],
  };
}

function snapshot(first: SnapshotPlayer[]): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    meta: { saveFileName: "e2e.fm", gameVersion: "24.3.0+0", gameDate: "2025-04-06", importedAt: "2025-04-06T00:00:00.000Z", importerVersion: "e2e",
      club: { id: 1, uid: 2, name: "Club E2E", nationOrdinal: 1 } },
    squads: { first, reserves: [], u18: [] },
    warnings: [],
  };
}

/** 18 first-team players, uids 9001..9018, named "Jugador Uno" ... "Jugador Dieciocho". */
export function squadA(): Snapshot {
  return snapshot(NAMES.map((n, i) => player(9001 + i, `Jugador ${n}`, MAIN[i], 100 + i)));
}
/** Squad A without uid 9018 and with a newcomer, uid 9101 "Jugador Nuevo". */
export function squadB(): Snapshot {
  const a = squadA().squads.first.filter((p) => p.uid !== 9018);
  return snapshot([...a, player(9101, "Jugador Nuevo", "ST", 110)]);
}
