import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SaveArchive } from "../../src/importer/savelens/archive.ts";
import { parseSave, type ParsedSave } from "../../src/importer/savelens/index.ts";
import { readContracts, type ContractRecord } from "../../src/importer/contracts.ts";
import { managedTeamFromTactics } from "../../src/importer/meta.ts";
import { resolveManagedSquads } from "../../src/importer/squads.ts";
import { findSampleSave } from "../helpers/sample.ts";

const SAVE = findSampleSave();
const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/${n}`, import.meta.url), "utf8"));
const X = 64.957475656354; // displayed dollars per year per stored pound per week

describe.skipIf(!SAVE)("sample save", () => {
  let parsed: ParsedSave;
  let contracts: Map<number, ContractRecord>;
  let tactics: Buffer;
  const byName = new Map<string, number[]>();

  beforeAll(() => {
    parsed = parseSave(SAVE!);
    const a = new SaveArchive(SAVE!);
    tactics = a.member("tactics_man.dat");
    a.close();
    contracts = readContracts(parsed.db, parsed.players.map((p) => ({ person: p.source.person, clubId: p.clubId })), parsed.gameDate);
    parsed.players.forEach((p, i) => byName.set(p.name, [...(byName.get(p.name) ?? []), i]));
  });

  function score(entries: { name: string; age?: number; wage: number | null; end: string }[]) {
    let end = 0, wage = 0, total = 0;
    for (const e of entries) {
      const cand = (byName.get(e.name) ?? []).filter((i) => e.age === undefined || parsed.players[i].age === e.age);
      if (!cand.length) continue;
      const r = contracts.get(cand[0]);
      total++;
      if (r && r.end === e.end) end++;
      if (e.wage === null || (r && Math.abs(r.wageGbpWeek * X - e.wage) / e.wage < 0.03)) wage++;
    }
    return { end, wage, total };
  }

  it("matches the Aberdeen first team wage and end date 19/19 and 19/19", () => {
    const gt = fixture("gt_aberdeen.json").players as Record<string, [number | null, string]>;
    const s = score(Object.entries(gt).map(([name, v]) => ({ name, wage: v[0], end: v[1] })));
    expect(s).toEqual({ end: 19, wage: 19, total: 19 });
  });
  it("matches the Aberdeen Sub-18 wage and end date 19/19 and 19/19", () => {
    const gt = fixture("gt_aberdeen_u18.json").players as Record<string, [number, number | null, string]>;
    const s = score(Object.entries(gt).map(([name, v]) => ({ name, age: v[0], wage: v[1], end: v[2] })));
    expect(s).toEqual({ end: 19, wage: 19, total: 19 });
  });
  it("matches the Aberdeen Reservas wage and end date 5/5 and 5/5", () => {
    const gt = fixture("gt_reservas_barca.json").reservas.players as Record<string, [number, number, string]>;
    const s = score(Object.entries(gt).map(([name, v]) => ({ name, age: v[0], wage: v[1], end: v[2] })));
    expect(s).toEqual({ end: 5, wage: 5, total: 5 });
  });

  it("reads the managed team value 1310 from the tactics header", () => {
    expect(managedTeamFromTactics(tactics)).toEqual({ teamValue: 1310, managerPersonId: 392082 });
  });
  it("resolves Aberdeen and the team values of its three squads", () => {
    const r = resolveManagedSquads({ db: parsed.db, clubs: parsed.clubs, teams: parsed.teams, managedTeamValue: 1310 });
    expect(r.club).toEqual({ id: 1122, uid: 1535, name: "Aberdeen", nationOrdinal: 167 });
    expect(r.teamValues).toEqual({ first: 1310, reserves: 65414, u18: 65416 });
  });
  it("puts 31, 5 and 33 players in the three squads", () => {
    const n = (v: number) => parsed.players.filter((p) => p.team === v).length;
    expect([n(1310), n(65414), n(65416)]).toEqual([31, 5, 33]);
  });
  it("resolves Barcelona from its team value 1446", () => {
    const r = resolveManagedSquads({ db: parsed.db, clubs: parsed.clubs, teams: parsed.teams, managedTeamValue: 1446 });
    expect([r.club.id, r.club.uid]).toEqual([1247, 1707]);
  });
});
