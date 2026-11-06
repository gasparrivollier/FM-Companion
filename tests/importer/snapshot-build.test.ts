import { describe, expect, it } from "vitest";
import { playerToSnapshot, POSITION_CODES } from "../../src/importer/snapshot.ts";
import type { Player } from "../../src/importer/savelens/index.ts";

const ABILITY = 100;
function db(heightCm: number, weightKg: number): Buffer {
  const b = Buffer.alloc(400);
  b.writeUInt16LE(weightKg, ABILITY + 82);
  b.writeUInt16LE(heightCm, ABILITY + 84);
  return b;
}
function parserPlayer(): Player {
  return {
    id: 5, uid: 50, name: "Ann Lee", fullName: "Ann Marie Lee", age: 20, birthDate: "2005-01-02", nationId: 167,
    otherNationIds: [], clubId: 1122, club: "Aberdeen", team: 1310, ca: 100, pa: 120,
    positions: ["GK"], positionRatings: [20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 14],
    attributes: { finishing: 12 }, rawAttributes: [], source: { person: 10, ability: ABILITY, identity: 20 },
  };
}

describe("playerToSnapshot", () => {
  it("names the 15 position codes in the parser order", () => {
    expect(POSITION_CODES).toEqual(["GK","SW","DL","DC","DR","DM","ML","MC","MR","AML","AMC","AMR","ST","WBL","WBR"]);
  });
  it("keeps every other field when the player has no contract and no relation table", () => {
    const s = playerToSnapshot(parserPlayer(), undefined, null, db(185, 75));
    expect(s.contract).toBeNull();
    expect(s.homeGrownClubs).toEqual([]);
    expect(s.homeGrownNations).toEqual([]);
    expect([s.uid, s.id, s.name, s.birthDate, s.nationOrdinal, s.ca, s.pa]).toEqual([50, 5, "Ann Lee", "2005-01-02", 167, 100, 120]);
    expect(s.positionRatings.GK).toBe(20);
    expect(s.positionRatings.WBR).toBe(14);
    expect(s.attributes).toEqual({ finishing: 12 });
    expect([s.heightCm, s.weightKg]).toEqual([185, 75]);
  });
  it("turns an unset weight (0) into null", () => {
    expect(playerToSnapshot(parserPlayer(), undefined, null, db(185, 0)).weightKg).toBeNull();
  });
  it("maps a contract and the relation table", () => {
    const s = playerToSnapshot(
      parserPlayer(),
      { clubId: 1122, clubFromParser: 1122, squadNumber: null, wageGbpWeek: 30, start: "2024-07-01", end: null, squadStatusCode: 11 },
      [{ referencedId: 1123, kind: 1, role: 72, qualifier: 8, sentinel: 255 }],
      db(185, 75),
    );
    expect(s.contract).toEqual({ clubId: 1122, wageGbpWeek: 30, start: "2024-07-01", end: null, squadNumber: null, squadStatusCode: 11 });
    expect(s.homeGrownClubs).toEqual([{ clubId: 1122, qualifier: 8 }]);
  });
});
