# FM24 Companion: documentation

Research and reference for the project, written during the research phase (2026-11-03) and extended since. The design is in `superpowers/specs/`, the plans in `superpowers/plans/`. The importer is built; the planner UI is planned.

## What the project is

FM24 Companion is a squad and tactics planner for Football Manager 24. The user gives the app their **save game** (a `.fm` file) and the app uses it as its base data. The visual and behavioural reference is the prototype in `design/Artboard-7agu.dc.html`.

## Reading order

| # | Document | Read it for |
|---|---|---|
| 01 | [Design functionalities](01-design-functionalities.md) | What the mockup does and which data each feature needs |
| 02 | [Save container](02-save-container.md) | How an `.fm` file is built and where the useful members are |
| 03 | [Data dictionary](03-data-dictionary.md) | **Every field we can read from a save: where it lives, how to decode it, how sure we are** |
| 04 | [UI glossary](04-ui-glossary.md) | Spanish labels in the game (attributes, positions, roles, duties, statuses) mapped to save values |
| 05 | [Validation](05-validation.md) | What was checked against the real game, with sample sizes; catalog of the ground-truth files |
| 06 | [Mockup to save mapping](06-mockup-to-save-mapping.md) | For each mockup feature: available, derivable, partial or missing |
| 07 | [Reproduction](07-reproduction.md) | The tools, the one-command pipeline, requirements and performance |
| 08 | [Limits and open questions](08-limits-and-open-questions.md) | What is not known, what is fragile, what we decided not to chase |
| 09 | [Distribution](09-distribution.md) | The desktop app: processes, the data folder, building the installer, the Windows check list, the open `uid` item |
| log | [research/](research/) | The chronological working notes (`fm24-save-files.md` has 23 numbered sections); kept as evidence, superseded by 02 to 08 for reference |

## Confidence labels used everywhere

| Label | Meaning |
|---|---|
| **Verified** | Compared with what the game shows on screen, on a stated number of cases, with zero mismatches |
| **Verified, rule-based** | Produced by a heuristic extractor that was scored against ground truth (score stated); may fail on shapes not yet seen |
| **Inferred** | Consistent with the evidence but not checked against the game |
| **Candidate** | Plausible pattern, explicitly not trusted |
| **Unknown** | Not found, or not attempted |

## Headline status

**Solid (verified on the sample save):**
- the container format and where each member lives;
- identity, age, nationality, positions, all attributes (including goalkeepers), CA/PA, height, weight, feet;
- which team squad (first team, Reservas, Sub-18) a player belongs to;
- contract wage, start, end, squad number and squad status for first-team, youth and reserve players, and for a second club;
- the managed club and manager, the in-game date;
- the squad selection (starting XI and substitutes) and the tactic names;
- home-grown club and home-grown nation ("canteranos").

**Partial:** squad status labels (7 of about 12 codes), tactic data (duty is decoded, role identity is not).

**Not obtained:** season and career statistics, tactic role identity and instructions, contract bonuses and clauses.

## Decisions taken so far

| Decision | Date | Consequence |
|---|---|---|
| The save game is the only input source | 2026-11-03 | The in-game table export (Ctrl+P, web page) is not used as a data path |
| Licensing of existing parsers is not a concern (personal project) | 2026-11-03 | Third-party parser code may be read, adapted and reused; attribution is kept as good practice |
| "Canteranos · liga local" means **players trained in the club's own country** | 2026-11-03 | Computed from the home-grown nation relation (Aberdeen first team: 10 of 31) |
| "Canteranos · plantel total" means players whose home-grown club is the club itself | 2026-11-03 | Aberdeen first team: 5 of 31 |
| Match players by **id**, never by displayed name | 2026-11-03 | The save stores registered names ("Pablo Páez" for Gavi); the game screen shows nicknames |
| Season statistics are out of scope for now | 2026-11-03 | The mockup does not use them; see 08 |
| Work under the Superpowers skills | 2026-11-03 | See `CLAUDE.md` |

## Repository map

```
CLAUDE.md                project instructions (Superpowers workflow, docs pointer)
design/                  the prototype exported from Claude (read-only reference)
docs/                    this documentation
tools/                   extraction tools and ground-truth files (see 07)
src/importer/            the save importer (writes the snapshot)
src/planner/             the planner UI: domain/ (pure logic), state/ (reducer, storage seams), ui/ (React)
src/shared/              the snapshot contract
src/electron/            the desktop shell: main process, preload, importer runner, file layer
scripts/                 esbuild bundling and the Electron dev launcher
.github/workflows/       the Windows installer build
tests/                   Vitest tests (integration tests skip without a save in saves/)
docs/superpowers/        design spec and implementation plans
saves/                   your save games (git-ignored, private)
out/                     generated intermediate files (git-ignored, large)
vendor/                  third-party parser sources (git-ignored)
```
