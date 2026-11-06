// Exports each player's team ordinal and the team table (type, owner club) using the vendored SaveLens 24 parser internals.
// usage: node tools/savelens-teams.ts "<save.fm>" out/teams.json
import { SaveArchive } from "../vendor/FM-SaveLens-24/server/parser/archive.ts";
import { readNames } from "../vendor/FM-SaveLens-24/server/parser/strings.ts";
import { readPeople, readAbilities, linkAbilities } from "../vendor/FM-SaveLens-24/server/parser/people.ts";
import { readClubs } from "../vendor/FM-SaveLens-24/server/parser/clubs.ts";
import { readTeams } from "../vendor/FM-SaveLens-24/server/parser/teams.ts";
import { writeFileSync } from "node:fs";
const [, , file, out] = process.argv;
const a = new SaveArchive(file);
const b = a.member("game_db.dat");
const names = readNames(b);
const people = readPeople(b, names);
const blocks = readAbilities(b, names.end);
const { linked } = linkAbilities(people, blocks);
const clubs = readClubs(b, names.start);
const teams = readTeams(b, clubs, names.start, new Set(people.filter((p) => p.id >= 0).map((p) => p.id)));
const players = linked.map(({ person, ability }) => ({ id: person.id, uid: person.uid, team: ability.team }));
writeFileSync(out, JSON.stringify({
  players,
  teams: teams.map((t) => ({ ordinal: t.ordinal, club: t.club, type: t.type, offset: t.offset, members: t.members.length })),
}));
console.error("players", players.length, "teams", teams.length);
a.close();
