# 07. Reproduction: tools, pipeline, requirements

Everything in 03 can be regenerated from a save with the tools in `tools/`. This is research tooling, not application code: it exists to prove the findings and to be a reference for a future implementation.

## 1. One command

From the repository root:

```bash
tools/prepare.sh "saves/<your save>.fm"
```

It runs four steps and ends with a self-check against the screenshot ground truth. On the sample (a 454 MB save) the whole run took **63 seconds** on the development machine (Fedora, Python 3.14, Node 22).

| Step | What it does | Time (sample) | Output |
|---|---|---|---|
| 1 | Runs SaveLens 24's reference parser (`tools/savelens-dump.ts`) | about 16 s, **peak memory about 2.1 GB** | `out/save.json` |
| 2 | Exports each player's team value and the team table (`tools/savelens-teams.ts`) | not timed separately | `out/teams.json` |
| 3 | Extracts `game_db.dat` (492 MB) and three small members (`tools/fm_members.py`) | not timed separately | `out/game_db.dat`, `out/m/tactics_man.dat`, `out/m/save_game_summary.dat`, `out/m/humans.dat` |
| 4 | Contract extractor over all players, then scores it against the ground truth (`tools/fm_contracts_eval.py`) | about 25 s for the extractor | prints scores |

Expected final lines for the sample:

```
players with a current contract: 163738 of 222391 | clubs recovered for club-less players: 18350 | refs: 7394
tools/gt_aberdeen.json: end ok 19/19, wage ok 19/19
tools/gt_aberdeen_u18.json: end ok 19/19, wage ok 19/19
reservas: end ok 5/5, wage ok 5/5
```

## 2. Requirements

| Need | Version | Why |
|---|---|---|
| Node.js | 22.18 or later (ran on 22.23.1) | runs the TypeScript parser directly with built-in type stripping; only `node:` built-ins are used. The vendored project's own application asks for Node 24, which the parser alone does not need |
| Python | **3.14 or later** | the standard library module `compression.zstd` reads Zstandard; older Pythons need the `zstandard` package instead |
| numpy | any 2.x (ran on 2.4.6) | `fm_contracts.index_records` |
| Vendored parser | `vendor/FM-SaveLens-24` (cloned with `git clone --depth 1 https://github.com/MSalman5230/FM-SaveLens-24.git vendor/FM-SaveLens-24`) | the player and club reader. The repository is **git-ignored**; its licence is none, and the project decision is that this does not matter for a personal project |
| Disk | about 1.5 GB for `out/` | `game_db.dat` (492 MB) and the 340 MB `save.json` |

Not needed: Rust (the SaveLens desktop app builds with it; the TypeScript reference parser does not).

## 3. The tools

| Tool | Purpose |
|---|---|
| `prepare.sh` | the pipeline above |
| `savelens-dump.ts` | players and clubs from the parser; writes `out/save.json` |
| `savelens-teams.ts` | team value per player and the team table |
| `fm_members.py` | list or extract members of a save (`list`, `extract OUTDIR names...`) |
| `fm_contracts.py` | **the contract extractor** (current), with `build(db, players, game_date)` |
| `fm_contracts_eval.py` | scores the extractor against `gt_*.json` |
| `fm_relations.py` | decodes a player's relation table (home-grown club and nation) |
| `contract_probe.py` | the **earlier prototype** of the extractor; superseded, kept for history |
| `contract_scale.py`, `contract_diag.py`, `contract_diag2.py`, `contract_diag3.py` | one-off exploration scripts for the prototype's failure modes; not part of the pipeline |
| `gt_*.json` | ground truth (see 05) |

The scripts read fixed paths under `out/`, so run them from the repository root.

## 4. The generated files

**`out/save.json`**: `{ name, formatVersion, gameDate, players[], clubs[], diagnostics, warnings }`.
- `players[]`: `id, uid, name, fullName, age, birthDate, nationId, otherNationIds, clubId, club, ca, pa, positions, positionRatings (15), attributes (62 keys), rawAttributes (62 values), source { person, ability, identity }`. The `source` offsets are what every other tool uses to find a player's bytes.
- `clubs[]`: `id, uid, nation, name, shortName, offset`.

**`out/teams.json`**: `{ players: [{ id, uid, team }], teams: [{ ordinal, club, type, offset, members }] }`. `team` is the team value of 03 section 5.2. Note that `club` in this table is the **parser's** reading, which is one row off for some teams (see 03).

**`out/game_db.dat`**: the decompressed main database, as read by the tools.

## 5. Using the building blocks

```python
import sys, json
sys.path.insert(0, "tools")
import fm_contracts as fc
from datetime import date

db = fc.load("out/game_db.dat")
players = json.load(open("out/save.json"))["players"]
contracts, ref_to_club = fc.build(db, players, date(2025, 4, 6))   # {player index: dict}
# dict keys: club_id, club_from_parser, number, wage_gbp_week, start, end, events, squad_status_raw, tag, end_pos
```

```python
from fm_relations import relations
entries = relations(db, p["source"]["person"], p["source"]["identity"])
# entries: (referenced id, kind, role, qualifier, sentinel); home-grown club = (1, 72) with id - 1
```

```bash
python3 -I tools/fm_members.py "saves/<save>.fm" list                      # members by size
python3 -I tools/fm_members.py "saves/<save>.fm" extract out/m tactics_man.dat
```

## 6. Adding ground truth

To check a new claim: take a screenshot of the relevant game screen, transcribe it into a `tools/gt_<name>.json` (names, ages, numbers exactly as shown, plus the game date), and add a scoring block to `fm_contracts_eval.py` or a small script. Rules used throughout:

- Match players by **age and name** (duplicates exist) or, better, by the `uid` in the profile header.
- Expect **display rounding** of wages (up to about 3%).
- Record what the screenshot showed, not what it should have shown.
- A single mismatch is reported, not hidden.

## 7. Known pitfalls in the tooling

- Reading the file by slicing the whole memory map for every frame is quadratic and does not finish; always use the manifest offsets.
- The parser holds 2.1 GB in memory; a browser or a small server would need a different strategy (see 08).
- `contract_probe.py` and the exploration scripts print numbers that are **worse** than the current extractor; do not use them for conclusions.
- `out/` is large and regenerated; never commit it. `saves/` holds private career data; never commit or share it.

## 8. The importer (TypeScript)

The application's importer lives in `src/importer/` and replaces the Python tools for production use; the tools stay as the research reference. It reads a save and writes a versioned snapshot (`src/shared/snapshot.ts`) of the managed club's three squads.

```bash
npm install
npm run import -- "saves/<your save>.fm" out/snapshot.json   # prints JSON lines: progress..., then done or error
npm test                                                     # unit tests; integration tests use saves/*.fm or $FM_SAVE and skip without it
```

On the sample save the whole run takes about 30 seconds and the output passes `isSnapshot`. The importer opens the save read-only (its size, modification time and SHA-256 are checked unchanged in `tests/importer/run.test.ts`). `src/importer/savelens/SOURCE.md` records the pinned parser.

