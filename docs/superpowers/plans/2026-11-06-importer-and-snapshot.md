# FM24 Companion: importer and snapshot (plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TypeScript importer that reads a FM24 `.fm` save and writes a versioned **snapshot** (the managed club's three squads with everything the planner needs), reproducing the validation scores of the Python research tools.

**Architecture:** A pure-TypeScript library in `src/importer/` built on a pinned copy of the SaveLens 24 reference parser, plus ports of the two research extractors (`tools/fm_contracts.py`, `tools/fm_relations.py`). A thin entry point runs it in its own process and reports progress as JSON lines. The planner (plan 2) will read only the snapshot.

**Tech Stack:** Node >= 22.18 (type stripping, `node:zlib` Zstandard), TypeScript (`erasableSyntaxOnly`), Vitest, npm.

**Spec:** `docs/superpowers/specs/2026-11-06-fm24-companion-design.md`. Data facts: `docs/03-data-dictionary.md`. Scores to reproduce: `docs/05-validation.md`.

**Scope of this plan.** Plans 2 (planner UI, from `design/Artboard-7agu.dc.html`) and 3 (Electron shell, importer as a child process, owner data store, `.exe` installer) are written after this one. Plan 2 can start as soon as Task 2 (the snapshot contract) is merged.

## Global Constraints

- The save is opened **read-only** and is never written, copied or uploaded. No code path makes a network call.
- Target is **Windows**, developed on Fedora: build every path with `node:path`, never assume `/`.
- The snapshot is **versioned** (`SNAPSHOT_VERSION = 1`), carries **raw relation values and qualifiers**, and is written **atomically** (temporary file, then rename). Each import replaces it as a whole.
- Players are identified by `uid` (and `id`), **never by name**.
- Game version: supported build is `24.3.0+0`. A different `24.x` build gives a **warning and continues**; a non-FM24 file is **rejected**.
- Wages are stored in **pounds per week**. The game's own rate is about **1.2492 dollars per pound** (`52 x 1.2492 = 64.9575` dollars per year per stored unit).
- Natural and "covers" are **not** computed here: the snapshot carries the 15 familiarity values (1 to 20).
- The importer must finish on the sample save in **under 120 seconds** and tolerate the parser's **~2.1 GB** memory use (run with `--max-old-space-size=4096`).
- The sample save `saves/Theo Walcott - Aberdeen - Canadá.fm` is private and git-ignored. Tests that need it **skip** when it is absent. `saves/`, `*.fm`, `out/`, `node_modules/`, `dist/` are git-ignored.
- No TypeScript enums, namespaces or parameter properties (Node type stripping must run the sources).

## Review Focus

Inputs the spec implies and no plain task test would exercise; each is pinned by a test in the task named.

1. A file that is not an FM24 save, or is truncated: a clear error code, and **no snapshot file** left behind (Task 8, Task 9).
2. An FM24 build other than `24.3.0+0`: a warning in `snapshot.warnings`, import continues (Task 3, Task 8).
3. The save file is byte-for-byte unchanged after an import (Task 9).
4. A player with no current contract or no end date: `contract` is `null` or `end` is `null`, the other fields stay intact, and a count appears in `warnings` (Task 7).
5. A managed club with no Reservas or no Sub-18 team: that squad is an empty array and the import succeeds (Task 6).

---

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | tooling |
| `src/importer/savelens/*` | pinned copy of the parser (`archive, attributes, clubs, index, people, strings, teams, nations.json`) and `SOURCE.md` |
| `src/shared/snapshot.ts` | snapshot types, `SNAPSHOT_VERSION`, `isSnapshot` |
| `src/importer/meta.ts` | game version check, in-game date, managed team value |
| `src/importer/relations.ts` | person relation table, home-grown extraction |
| `src/importer/contracts.ts` | contract extractor |
| `src/importer/squads.ts` | team uids, managed club and its three squads |
| `src/importer/snapshot.ts` | `buildSnapshot` |
| `src/importer/validate.ts` | sanity checks, atomic write, `ImportError` |
| `src/importer/run.ts` | process entry, JSON-lines progress |
| `src/importer/compare.ts` | `compareSnapshots` for the uid-stability check |
| `tests/fixtures/` | copies of `tools/gt_*.json` |
| `tests/importer/*.test.ts` | unit tests (synthetic buffers) and one integration file on the sample save |

---

### Task 1: Project scaffold and pinned parser

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/importer/savelens/` (copy of `vendor/FM-SaveLens-24/server/parser/*`), `src/importer/savelens/SOURCE.md`, `tests/importer/savelens.test.ts`
- Modify: `.gitignore` (add `node_modules/`, `dist/`)

**Interfaces:**
- Produces: `parseSave`, `PARSER_VERSION`, `SaveArchive`, `SaveError`, `readNames`, `readPeople`, `readAbilities`, `linkAbilities`, `readClubs`, `readTeams` from `src/importer/savelens/*.ts` (signatures as in the vendored files).

- [ ] **Step 1: Initialise.** The folder is not a git repository: run `git init`, then `npm init -y` and install `typescript`, `vitest`, `@types/node` as dev dependencies. `tsconfig.json`: `strict`, `target ES2023`, `module nodenext`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `noEmit`. `vitest.config.ts`: `pool: "forks"`, `testTimeout: 180000`. Scripts: `test` (`vitest run`), `typecheck` (`tsc --noEmit`).
- [ ] **Step 2: Copy the parser** from `vendor/FM-SaveLens-24/server/parser/` into `src/importer/savelens/`. `SOURCE.md` records the origin repository, commit `6687bd9d4357d8719e27b4e31329de1ecb6b61b0`, and that the version gate in `index.ts` is patched in Task 3.
- [ ] **Step 3: Write the failing test** `tests/importer/savelens.test.ts`: `it("exposes the pinned parser", ...)` asserting `PARSER_VERSION === "fm24-7"` and `typeof parseSave === "function"`.
- [ ] **Step 4: Run** `npx vitest run tests/importer/savelens.test.ts`. Expected: FAIL before the copy is wired, PASS after. Then run `npm run typecheck`; expected: no errors.
- [ ] **Step 5: Commit** `chore: scaffold project and pin the SaveLens parser`.

---

### Task 2: Snapshot contract

**Files:**
- Create: `src/shared/snapshot.ts`, `tests/importer/snapshot-contract.test.ts`

**Interfaces:**
- Produces:

```ts
export const SNAPSHOT_VERSION = 1;
export type SquadKind = "first" | "reserves" | "u18";
export type PositionCode = "GK"|"SW"|"DL"|"DC"|"DR"|"DM"|"ML"|"MC"|"MR"|"AML"|"AMC"|"AMR"|"ST"|"WBL"|"WBR";
export interface Contract { clubId: number; wageGbpWeek: number; start: string; end: string | null;
  squadNumber: number | null /* 255 = none */; squadStatusCode: number | null; }
export interface HomeGrownClub { clubId: number; qualifier: number }
export interface HomeGrownNation { nationOrdinal: number; qualifier: number }
export interface SnapshotPlayer { uid: number; id: number; name: string; fullName: string; birthDate: string;
  nationOrdinal: number; ca: number; pa: number; positionRatings: Record<PositionCode, number>;
  attributes: Record<string, number> /* displayed 1-20, parser keys */; heightCm: number | null; weightKg: number | null;
  contract: Contract | null; homeGrownClubs: HomeGrownClub[]; homeGrownNations: HomeGrownNation[]; }
export interface SnapshotMeta { saveFileName: string; gameVersion: string; gameDate: string; importedAt: string;
  importerVersion: string; club: { id: number; uid: number; name: string; nationOrdinal: number }; }
export interface Snapshot { version: typeof SNAPSHOT_VERSION; meta: SnapshotMeta;
  squads: Record<SquadKind, SnapshotPlayer[]>; warnings: string[]; }
export function isSnapshot(x: unknown): x is Snapshot;
```

- [ ] **Step 1: Write the failing tests:** `accepts a minimal valid snapshot`, `rejects a wrong version`, `rejects a squad that is not an array`, `rejects a player without uid`.
- [ ] **Step 2: Run** `npx vitest run tests/importer/snapshot-contract.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the types and `isSnapshot` (structural checks on version, meta fields, the three squad arrays, and `uid`/`id`/`birthDate` on each player).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add versioned snapshot contract`.

---

### Task 3: Save metadata and version gate

**Files:**
- Create: `src/importer/meta.ts`, `tests/importer/meta.test.ts`
- Modify: `src/importer/savelens/index.ts` (replace the hard `UNSUPPORTED_VERSION` throw with `checkFormatVersion` and push its warning into the result's `warnings`)

**Interfaces:**
- Produces:

```ts
export const SUPPORTED_BUILD = "24.3.0+0";
export function checkFormatVersion(v: string): { ok: boolean; warning?: string };
export function gameDateFromDb(db: Buffer): string;            // u16@36 & 511 = day of year, u16@38 = year
export function managedTeamFromTactics(t: Buffer): { teamValue: number; managerPersonId: number }; // u32@19, u32@11
```

- [ ] **Step 1: Write failing tests** (synthetic buffers): `checkFormatVersion("24.3.0+0")` is `{ ok: true }`; `"24.4.1+0"` is `ok: true` with a warning that names the version; `"23.4.0+0"` and `"garbage"` are `ok: false`. `gameDateFromDb` on a buffer with day 96 and year 2025 at the right offsets returns `"2025-04-06"`. `managedTeamFromTactics` on a 29-byte header with `1310` at 19 and `392082` at 11 returns both.
- [ ] **Step 2: Run** `npx vitest run tests/importer/meta.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions and patch the parser gate to call `checkFormatVersion`.
- [ ] **Step 4: Run** the test file. Expected: PASS; run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat: read game date, managed team and gate the format version`.

---

### Task 4: Relation table and home-grown extraction

**Files:**
- Create: `src/importer/relations.ts`, `tests/importer/relations.test.ts`
- Reference: `tools/fm_relations.py`, `docs/03-data-dictionary.md` section 8

**Interfaces:**
- Produces:

```ts
export interface RelationEntry { referencedId: number; kind: number; role: number; qualifier: number; sentinel: number }
export function readRelations(db: Buffer, personOffset: number, identityOffset?: number): RelationEntry[] | null;
export function homeGrownFrom(entries: RelationEntry[]): { clubs: HomeGrownClub[]; nations: HomeGrownNation[] };
// clubs: kind 1, role 72, clubId = referencedId - 1.  nations: kind 8, role 70, nationOrdinal = referencedId.
```

- [ ] **Step 1: Write failing unit tests** with a synthetic person buffer built by a test helper (`end = personOffset + 19 + u32@(personOffset+15)`, flag byte 1 at `end+33`, count at `end+34`, 16-byte entries from `end+35`): `returns null when the flag byte is not 1`, `returns null when the table overruns the identity offset`, `reads kind, role and qualifier of each entry`; and `homeGrownFrom` over `[(1123,1,72,1), (1123,1,72,8), (167,8,70,2), (96113,3,1,10)]` returns clubs `[{clubId:1122,qualifier:1},{clubId:1122,qualifier:8}]` and nations `[{nationOrdinal:167,qualifier:2}]`.
- [ ] **Step 2: Run** `npx vitest run tests/importer/relations.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions as ports of the Python (`struct` reads become `Buffer.readUInt32LE`).
- [ ] **Step 4: Run.** Expected: PASS. (Real-save checks for Steven and Duncan live in Task 7.)
- [ ] **Step 5: Commit** `feat: port the relation table reader`.

---

### Task 5: Contract extractor

**Files:**
- Create: `src/importer/contracts.ts`, `tests/importer/contracts.test.ts`, `tests/fixtures/gt_aberdeen.json`, `gt_aberdeen_u18.json`, `gt_reservas_barca.json` (copies from `tools/`)
- Reference: `tools/fm_contracts.py` (the algorithm, including its docstring), `docs/03` section 6

**Interfaces:**
- Consumes: parser players (`source.person`, `clubId`).
- Produces:

```ts
export interface ContractInput { person: number; clubId: number | null }
export interface ContractRecord { clubId: number; clubFromParser: number | null; squadNumber: number | null;
  wageGbpWeek: number; start: string; end: string | null; squadStatusCode: number | null }
export function dateAt(db: Buffer, offset: number): string | null;        // u16 day (& 511, 1..366) + u16 year (2000..2060)
export function endOf(db: Buffer, rec: number, start: string | null): { end: string; k: number; pos: number } | null;
export function readContracts(db: Buffer, players: ContractInput[], gameDate: string): Map<number, ContractRecord>; // key = index in `players`
```

- [ ] **Step 1: Write failing unit tests:** `dateAt` returns `"2025-04-06"` for day 96, year 2025 and `null` for the null date `01 00 6c 07`; `endOf` finds the end date on a synthetic record built per section 6.2 (k = 2 events of 29 bytes, `ff ff ff ff` marker, event count 1 at `end+14`) and returns `null` when the count disagrees.
- [ ] **Step 2: Write the failing integration tests** (in the shared sample file of Task 7, listed here so the target is explicit): wage and end date match `gt_aberdeen.json` **19/19 and 19/19**, `gt_aberdeen_u18.json` **19/19 and 19/19**, Reservas **5/5 and 5/5**. A wage matches when `|wageGbpWeek x 64.957475656354 - shown| / shown < 0.03`; players are matched by name **and age** (the screen has no uid), as `tools/fm_contracts_eval.py` does.
- [ ] **Step 3: Implement** `readContracts` by porting `tools/fm_contracts.py` (`index_records` becomes a scan of the buffer for the club-reference `u32` at all four alignments against a `Set<number>`; `chain` becomes `Buffer.indexOf` of `01 00 6c 07`). Keep the rules exactly: window bounded by the previous person record plus 250 bytes (and at most 3000 bytes back); club reference by voting (>= 2 votes, else most common); affiliated clubs (>= 5 players and >= 15 %); latest start not after the game date; the older record wins when wage and end date match an affiliate registration. The ported function must not mutate its inputs.
- [ ] **Step 4: Run** the unit tests now and the integration scores in Task 7. Expected: PASS.
- [ ] **Step 5: Commit** `feat: port the contract extractor`.

---

### Task 6: Team uids, managed club and its squads

**Files:**
- Create: `src/importer/squads.ts`, `tests/importer/squads.test.ts`
- Reference: `tools/savelens-teams.ts`, `docs/03` section 5

**Interfaces:**
- Consumes: parser clubs and teams, each player's team value (`u32` at `ability - 23`), `managedTeamFromTactics`.
- Produces:

```ts
export function teamValueOf(db: Buffer, abilityOffset: number): number;          // u32 at ability - 23
export function teamUidOf(db: Buffer, teamHeadOffset: number): number;           // u32 at team head + 18 (ordinal at +14)
export interface ManagedSquads { club: SnapshotMeta["club"]; teamValues: Record<SquadKind, number | null>; }
export function resolveManagedSquads(args: { db: Buffer; clubs: Club[]; teams: Team[]; managedTeamValue: number }): ManagedSquads;
```

- [ ] **Step 1: Write failing tests.** Unit: `teamValueOf` and `teamUidOf` on synthetic buffers. Integration (sample, in Task 7's file): `team ordinal -> team uid` is `1310 -> 1536`, `65414 -> 2000341187`, `65416 -> 2000341189`, `1446 -> 1708`, `1421 -> 1668`; `resolveManagedSquads` gives club Aberdeen (id 1122, uid 1535), `first = 1310`, `reserves = 65414`, `u18 = 65416`. Unit (synthetic): a club with no Reservas or no Sub-18 team returns `null` for that team value (Review Focus 5).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `teamValueOf`, `teamUidOf`, and `resolveManagedSquads`. The club is the one whose uid is `team uid of managedTeamValue - 1` (main team uid = club uid + 1). **The rule that finds a club's Reservas and Sub-18 team values is not yet documented.** The parser's own `club` field for teams is one row off, so it cannot be trusted. Investigate with `out/teams.json` (team head `type` 100 = Reservas, 18 = Sub-18; their uids are in the 2,000,000,000 range) and record the rule you find in `docs/03` section 5.2. **Acceptance:** the three Aberdeen values above. If no rule reproduces them, return `null` for the two secondary squads, add a warning, and tell the owner; do not guess.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: resolve the managed club and its squads`.

---

### Task 7: Snapshot builder and the sample-save integration tests

**Files:**
- Create: `src/importer/snapshot.ts`, `tests/importer/sample-save.test.ts`, `tests/helpers/sample.ts`, `tests/fixtures/gt_gartenmann.json`, `gt_profiles.json`, `gt_tactics.json` (copies)
- Modify: none

**Interfaces:**
- Consumes: everything from Tasks 2 to 6.
- Produces:

```ts
export const IMPORTER_VERSION = "1";
export interface BuildOptions { onProgress?: (percent: number, message: string) => void }
export function buildSnapshot(savePath: string, options?: BuildOptions): Snapshot;
export function findSampleSave(): string | null;   // tests/helpers/sample.ts: env FM_SAVE, else the first saves/*.fm
```

Height is the `u16` at `ability + 84` (cm) and weight the `u16` at `ability + 82` (kg, `0` means unset and becomes `null`). A squad number of `255` becomes `null`. Players with no current contract get `contract: null`; their count goes into `warnings` ("N players without a contract"), as does a count of contracts without an end date.

- [ ] **Step 1: Write the failing integration file.** It builds the snapshot **once** in `beforeAll` (skipped by `describe.skipIf(!findSampleSave())`) and asserts, each as its own `it`:
  - meta: `gameVersion "24.3.0+0"`, `gameDate "2025-04-06"`, club `Aberdeen`, id `1122`, uid `1535`, `nationOrdinal 167`.
  - squads: `first` 31 players, `reserves` 5, `u18` 33.
  - Contract scores of Task 5 (19/19, 19/19, 19/19, 19/19, 5/5, 5/5).
  - Jordan Steven (uid `2002207798`, id `432932`, born `2008-04-03`): squad number 35, status code 11, end `2028-05-31`, `wageGbpWeek` 30, home-grown clubs `[{1122,1},{1122,8}]`, nations `[{167,2}]`.
  - Ryan Duncan (uid `2000032635`, id `168792`, born `2004-01-18`): number 22, status 4, end `2026-05-31`, home-grown clubs `[{1122,1},{1122,8}]`, nations `[{167,1}]`.
  - Canteranos counts over `first`: players with a home-grown club of 1122 = **5**; players with a home-grown nation of 167 = **10**.
  - Attributes: Gartenmann's **36 of 36** displayed attributes match `gt_gartenmann.json` (Spanish labels mapped by `docs/04-ui-glossary.md`).
  - Heights and weights match `gt_profiles.json` for the **8 of 8** profiles; dates of birth match.
  - Squad numbers of the squad selected in `gt_tactics.json` match **20 of 20**.
  - Review Focus 4: a player known to have no contract appears with `contract: null` while his other fields are filled, and `warnings` contains the count line.
- [ ] **Step 2: Run** `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run tests/importer/sample-save.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `buildSnapshot`.** One approach: `parseSave` for players and clubs; open the archive for `game_db.dat`, `tactics_man.dat`; compute the team value of each parser player from `source.ability`; run `readContracts` and `readRelations`; assign each player to a squad by team value; map `positionRatings` (the parser's order `GK, SW, DL, DC, DR, DM, ML, MC, MR, AML, AMC, AMR, ST, WBL, WBR`) to `PositionCode` keys.
- [ ] **Step 4: Run** the same command. Expected: PASS (about 60 to 90 seconds).
- [ ] **Step 5: Commit** `feat: build the snapshot from a save`.

---

### Task 8: Validation, errors and atomic write

**Files:**
- Create: `src/importer/validate.ts`, `tests/importer/validate.test.ts`

**Interfaces:**
- Produces:

```ts
export type ImportErrorCode = "NOT_A_SAVE" | "UNSUPPORTED_VERSION" | "TRUNCATED" | "NO_MANAGED_CLUB" | "OUT_OF_MEMORY" | "INTERNAL";
export class ImportError extends Error { code: ImportErrorCode; constructor(code: ImportErrorCode, message: string) }
export function sanityWarnings(s: Snapshot): string[];           // first-team size outside 15..60, wage outside 1..500000, age outside 14..45
export function toImportError(e: unknown): ImportError;           // maps parser SaveError codes and RangeError (memory) to ImportErrorCode
export function writeSnapshotAtomically(path: string, s: Snapshot): void; // write `<path>.tmp`, then rename
```

- [ ] **Step 1: Write failing tests:** `sanityWarnings` flags a first team of 3 players and a wage of 0; `toImportError` maps a parser `SaveError` with code `UNSUPPORTED_VERSION` to the same code and a non-FM file's error to `NOT_A_SAVE`; `writeSnapshotAtomically` leaves **no file** at the target path when serialisation throws midway, and replaces an existing snapshot only on success (Review Focus 1).
- [ ] **Step 2: Run** `npx vitest run tests/importer/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four exports; `buildSnapshot` calls `sanityWarnings` and appends the result to `warnings`.
- [ ] **Step 4: Run.** Expected: PASS. A test for Review Focus 2 asserts that a `24.4.1+0` result of `checkFormatVersion` ends up in `snapshot.warnings` through `buildSnapshot`'s warning merge (unit-level, with the parser stubbed).
- [ ] **Step 5: Commit** `feat: validate imports and write snapshots atomically`.

---

### Task 9: Process entry and read-only guarantee

**Files:**
- Create: `src/importer/run.ts`, `tests/importer/run.test.ts`
- Modify: `package.json` (script `import`: `node --max-old-space-size=4096 src/importer/run.ts`), `docs/07-reproduction.md` (new section "The importer"), `CLAUDE.md` (one line: how to run the importer and the tests)

**Interfaces:**
- Produces: a process started as `node src/importer/run.ts <savePath> <outPath>` that prints one JSON object per line on stdout: `{"type":"progress","percent":n,"message":s}`, then `{"type":"done","outPath":p,"warnings":[...]}` or `{"type":"error","code":ImportErrorCode,"message":s}`. Exit code 0 on done, 1 on error.

- [ ] **Step 1: Write failing tests (spawned process).** `a missing file gives an error line with code NOT_A_SAVE, exit code 1 and no output file`; `a text file renamed to .fm gives NOT_A_SAVE and no output file` (Review Focus 1). With the sample save: `exits 0, the last line is done, the output passes isSnapshot, elapsed under 120 s`; `the save's size, modification time and SHA-256 are unchanged after the run` (Review Focus 3).
- [ ] **Step 2: Run** `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run tests/importer/run.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `run.ts`** around `buildSnapshot`, `toImportError` and `writeSnapshotAtomically`. Progress goes through `onProgress`; nothing but JSON lines is written to stdout.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then run the whole suite `npm test`; expected: all pass (integration files skip without the sample save).
- [ ] **Step 5: Commit** `feat: run the importer as a separate process`.

---

### Task 10: Snapshot comparison for the uid-stability check

**Files:**
- Create: `src/importer/compare.ts`, `tests/importer/compare.test.ts`
- Modify: `package.json` (script `uid-check`: `node src/importer/compare.ts`, reading two snapshot paths)

**Interfaces:**
- Produces:

```ts
export interface UidReport { common: number; sameIdentity: number;
  changedIdentity: { uid: number; a: string; b: string }[]; onlyInA: number[]; onlyInB: number[] }
export function compareSnapshots(a: Snapshot, b: Snapshot): UidReport;   // identity = fullName + birthDate
```

- [ ] **Step 1: Write failing tests:** two synthetic snapshots with 3 shared uids where one has a different `birthDate` give `common 3`, `sameIdentity 2`, one `changedIdentity` entry; uids present on one side only land in `onlyInA` or `onlyInB`.
- [ ] **Step 2: Run** `npx vitest run tests/importer/compare.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `compareSnapshots` over all three squads of each snapshot, plus the small CLI that prints the report.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add the uid-stability comparison`. The **real check** waits for a second save of the same career from the owner; the result decides whether the fallback in spec section 9 is needed.

---

## Self-review

- **Spec coverage:** snapshot contract and versioning (Task 2), read-only and no network (Global Constraints, Task 9), three squads (Tasks 6 and 7), natural/covers left to the planner (carried ratings), home-grown raw values with qualifiers (Tasks 4 and 7), game-version warning (Tasks 3 and 8), validation scores (Tasks 5 and 7), separate process and under-120-second budget (Task 9), uid stability check (Task 10). **Not in this plan, by design:** the planner UI (plan 2), the Electron shell, owner data store, import merge and installer (plan 3).
- **Known risks carried into execution:** the rule that finds Reservas and Sub-18 team values is undocumented (Task 6 acceptance and fallback); only Aberdeen has wage and end-date ground truth; plain (uncompressed) saves are untested and need a file from the owner.
- **Type consistency:** `SnapshotPlayer`, `Contract`, `HomeGrownClub`, `HomeGrownNation`, `SquadKind` and `PositionCode` are defined in Task 2 and used unchanged in Tasks 4, 7, 8 and 10. The contract field is `wageGbpWeek` throughout.
