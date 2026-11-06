import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SaveArchive } from "../../src/importer/savelens/archive.ts";
import { parseSave, type ParsedSave } from "../../src/importer/savelens/index.ts";
import { managedTeamFromTactics } from "../../src/importer/meta.ts";
import { resolveManagedSquads } from "../../src/importer/squads.ts";
import { buildSnapshotFrom } from "../../src/importer/snapshot.ts";
import type { Snapshot, SnapshotPlayer } from "../../src/shared/snapshot.ts";
import { findSampleSave } from "../helpers/sample.ts";

const SAVE = findSampleSave();
const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/${n}`, import.meta.url), "utf8"));
const X = 64.957475656354; // displayed dollars per year per stored pound per week

const ATTRIBUTE_KEYS: Record<string, string> = {
  Cabeceo: "heading", Centros: "crossing", Control: "firstTouch", Entradas: "tackling", Marcaje: "marking", Pases: "passing",
  Penalti: "penaltyTaking", Regate: "dribbling", Remate: "finishing", "Saques de esquina": "corners", "Saques largos": "longThrows",
  "Técnica": "technique", "Tiros lejanos": "longShots", "Tiros libres": "freeKickTaking",
  Agresividad: "aggression", "Anticipación": "anticipation", "Colocación": "positioning", Concentración: "concentration",
  Decisiones: "decisions", Desmarques: "offTheBall", "Determinación": "determination", "Juego en equipo": "teamwork",
  Liderazgo: "leadership", Sacrificio: "workRate", Serenidad: "composure", Talento: "flair", "Valentía": "bravery", "Visión": "vision",
  "Aceleración": "acceleration", Agilidad: "agility", "Alcance de salto": "jumpingReach", Equilibrio: "balance", Fuerza: "strength",
  "Recuperación física": "naturalFitness", Resistencia: "stamina", Velocidad: "pace",
};

function ageOn(birth: string, date: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

describe.skipIf(!SAVE)("sample save", () => {
  let parsed: ParsedSave;
  let snapshot: Snapshot;
  let tactics: Buffer;
  let all: SnapshotPlayer[];
  const byUid = (uid: number) => all.find((p) => p.uid === uid)!;

  beforeAll(() => {
    parsed = parseSave(SAVE!);
    const a = new SaveArchive(SAVE!);
    tactics = a.member("tactics_man.dat");
    a.close();
    snapshot = buildSnapshotFrom(parsed, tactics, "sample.fm");
    all = [...snapshot.squads.first, ...snapshot.squads.reserves, ...snapshot.squads.u18];
  });

  function score(entries: { name: string; age?: number; wage: number | null; end: string }[]) {
    let end = 0, wage = 0, total = 0;
    for (const e of entries) {
      const cand = all.filter((p) => p.name === e.name && (e.age === undefined || ageOn(p.birthDate, snapshot.meta.gameDate) === e.age));
      if (!cand.length) continue;
      const c = cand[0].contract;
      total++;
      if (c && c.end === e.end) end++;
      if (e.wage === null || (c && Math.abs(c.wageGbpWeek * X - e.wage) / e.wage < 0.03)) wage++;
    }
    return { end, wage, total };
  }

  it("reads the save metadata", () => {
    expect(snapshot.version).toBe(1);
    expect(snapshot.meta.gameVersion).toBe("24.3.0+0");
    expect(snapshot.meta.gameDate).toBe("2025-04-06");
    expect(snapshot.meta.club).toEqual({ id: 1122, uid: 1535, name: "Aberdeen", nationOrdinal: 167 });
  });
  it("reads the managed team value 1310 from the tactics header", () => {
    expect(managedTeamFromTactics(tactics)).toEqual({ teamValue: 1310, managerPersonId: 392082 });
  });
  it("resolves Barcelona from its team value 1446", () => {
    const r = resolveManagedSquads({ db: parsed.db, clubs: parsed.clubs, teams: parsed.teams, managedTeamValue: 1446 });
    expect([r.club.id, r.club.uid]).toEqual([1247, 1707]);
  });
  it("puts 31, 5 and 33 players in the three squads", () => {
    expect([snapshot.squads.first.length, snapshot.squads.reserves.length, snapshot.squads.u18.length]).toEqual([31, 5, 33]);
  });
  it("matches the Aberdeen first team wage and end date 19/19 and 19/19", () => {
    const gt = fixture("gt_aberdeen.json").players as Record<string, [number | null, string]>;
    expect(score(Object.entries(gt).map(([name, v]) => ({ name, wage: v[0], end: v[1] })))).toEqual({ end: 19, wage: 19, total: 19 });
  });
  it("matches the Aberdeen Sub-18 wage and end date 19/19 and 19/19", () => {
    const gt = fixture("gt_aberdeen_u18.json").players as Record<string, [number, number | null, string]>;
    expect(score(Object.entries(gt).map(([name, v]) => ({ name, age: v[0], wage: v[1], end: v[2] })))).toEqual({ end: 19, wage: 19, total: 19 });
  });
  it("matches the Aberdeen Reservas wage and end date 5/5 and 5/5", () => {
    const gt = fixture("gt_reservas_barca.json").reservas.players as Record<string, [number, number, string]>;
    expect(score(Object.entries(gt).map(([name, v]) => ({ name, age: v[0], wage: v[1], end: v[2] })))).toEqual({ end: 5, wage: 5, total: 5 });
  });
  it("reads Jordan Steven's contract and home-grown relations", () => {
    const p = byUid(2002207798);
    expect([p.id, p.birthDate]).toEqual([432932, "2008-04-03"]);
    expect(p.contract).toMatchObject({ squadNumber: 35, squadStatusCode: 11, end: "2028-05-31", wageGbpWeek: 30 });
    expect(p.homeGrownClubs).toEqual([{ clubId: 1122, qualifier: 1 }, { clubId: 1122, qualifier: 8 }]);
    expect(p.homeGrownNations).toEqual([{ nationOrdinal: 167, qualifier: 2 }]);
  });
  it("reads Ryan Duncan's contract and home-grown relations", () => {
    const p = byUid(2000032635);
    expect([p.id, p.birthDate]).toEqual([168792, "2004-01-18"]);
    expect(p.contract).toMatchObject({ squadNumber: 22, squadStatusCode: 4, end: "2026-05-31" });
    expect(Math.abs(p.contract!.wageGbpWeek * X - 65000) / 65000).toBeLessThan(0.03);
    expect(p.homeGrownClubs).toEqual([{ clubId: 1122, qualifier: 1 }, { clubId: 1122, qualifier: 8 }]);
    expect(p.homeGrownNations).toEqual([{ nationOrdinal: 167, qualifier: 1 }]);
  });
  it("counts 5 first-team players home-grown at the club and 10 in the club's nation", () => {
    const first = snapshot.squads.first;
    expect(first.filter((p) => p.homeGrownClubs.some((h) => h.clubId === 1122)).length).toBe(5);
    expect(first.filter((p) => p.homeGrownNations.some((h) => h.nationOrdinal === 167)).length).toBe(10);
  });
  it("matches Gartenmann's 36 displayed attributes", () => {
    const gt = fixture("gt_gartenmann.json").attributes_1_20 as Record<string, Record<string, number>>;
    const p = byUid(27092473);
    let ok = 0, total = 0;
    for (const group of Object.values(gt)) {
      for (const [label, value] of Object.entries(group)) {
        total++;
        if (p.attributes[ATTRIBUTE_KEYS[label]] === value) ok++;
      }
    }
    expect([ok, total]).toEqual([36, 36]);
  });
  it("matches height and weight of the 8 profiles", () => {
    const gt = fixture("gt_profiles.json").players as Record<string, { uid: number; height_cm: number; weight_kg: number; dob?: string | null }>;
    let ok = 0;
    for (const v of Object.values(gt)) {
      const p = byUid(v.uid);
      if (p && p.heightCm === v.height_cm && p.weightKg === v.weight_kg && (v.dob == null || p.birthDate === v.dob)) ok++;
    }
    expect([ok, Object.keys(gt).length]).toEqual([8, 8]);
  });
  it("matches the squad numbers of the selected squad 20 of 20", () => {
    const gt = fixture("gt_tactics.json") as { xi: { player: string; number: number }[]; subs: { player: string; number: number }[] };
    const sel = [...gt.xi, ...gt.subs];
    const ok = sel.filter((s) => snapshot.squads.first.some((p) => p.name === s.player && p.contract?.squadNumber === s.number)).length;
    expect([ok, sel.length]).toEqual([20, 20]);
  });
  it("reports players without a contract in the warnings only when there are some", () => {
    const missing = all.filter((p) => p.contract === null).length;
    expect(snapshot.warnings.some((w) => w.includes("without a current contract"))).toBe(missing > 0);
  });
});
