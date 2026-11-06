# FM24 Companion: design

Status: **draft for the owner's approval**. Written 2026-11-06 from the brainstorming conversation. Things the owner decided are stated as decided. Things marked **(my call)** were chosen by the author and are open to change.

Reference documents: `docs/README.md` (index), `docs/03-data-dictionary.md` (what the save holds and how sure we are), `docs/06-mockup-to-save-mapping.md` (mockup against save), `design/Artboard-7agu.dc.html` (the visual and behavioural reference).

## 1. Intent

The owner plays Football Manager 24 and wants a squad and tactics planner at hand for the current season and the next two. The prototype in `design/` shows what it should look like and do. The only input is the `.fm` save game. The save is loaded about twice per season (start and mid-season). Between loads the owner works inside the tool: lays out an XI, plans depth per position, and looks ahead at ageing and expiring contracts.

Why a desktop tool: it runs on the same Windows PC as the game, with no account and no server, and the save is private career data that should never leave that machine.

## 2. Goals

1. Read a FM24 save and produce the managed club's squads (first team, Reservas, Sub-18) with the data the prototype needs.
2. Provide the whole prototype's feature set (section 5). The only prototype-adjacent feature left out is automatic XI generation (section 3).
3. Re-importing a newer save refreshes the game data and **never touches the owner's own data** (plans, tactics, views, position judgements, settings).
4. Ship as a single Windows installer (`.exe`).

## 3. Non-goals

- **Automatic XI generation.** Excluded from this project. It is a later project of its own.
- Season and career statistics, xG and average ratings (not decoded; see `docs/08` section 3.1).
- Exact reproduction of the game's home-grown rule (research deferred; see section 7).
- Choosing another club than the one managed in the save, other languages than Spanish, mobile or web versions, staff data, any writing to the save.

## 4. Anti-goals (a failure even if everything else works)

- Modifying the save file in any way.
- Sending any data off the machine (the app makes no network calls).
- Losing or overwriting the owner's own data on import.
- Matching players by displayed name when a `uid` is available.
- Showing a decoded value that has not been validated as if it were certain (for example unlabelled squad-status codes).

## 5. Scope: the prototype, complete

Described in `docs/01-design-functionalities.md`. In summary:

- Header with team name and Settings (team name, year the season ends, two colours with swap and reset, **currency selector**, section 6.5).
- Three season tabs (current, +1, +2), each with its own formation and XI. Age is projected by one year per season. Contracts expiring before the selected season are flagged. "Copy current plan" and "Clear XI".
- Eight preset formations, user-saved custom tactics (save, update, delete, unsaved-changes indicator), formation switching that remaps players.
- Pitch with 11 draggable position tokens, fit badges (covers, out of position), alert dot.
- Slot editing: roles per position, depth bands (starter 1, backups 2, replacements 3, others), candidate list by fit with "show all positions" and "show U18".
- Squad analysis: three charts by position group (count, weekly wages, average age), whole squad or XI.
- Squad table: search, group filters, sortable columns, column picker, views (Basic, Tactical, Contracts, Finance plus saved views).
- Player detail with the manager's own position model (not covered, natural, covers).
- Two KPIs: "canteranos total" and "canteranos local league" (section 7).
- All user data persisted locally.

The "Cargar save" action replaces the prototype's table-import button.

## 6. Decisions

### 6.1 Decided by the owner

| Topic | Decision |
|---|---|
| Form | Desktop application, Electron with TypeScript |
| Target | Windows, same PC as the game |
| Packaging | One installer `.exe`; no `.msi`; no code signing |
| Input | The `.fm` save only |
| Load frequency | About twice per season; a heavy import (up to a couple of minutes) is acceptable |
| Imported squads | All three (first team, Reservas, Sub-18) |
| Position model | Import proposes **natural = familiarity 20** and **covers = 15 or more**; the owner's manual marks are kept and always win over imported values |
| Currency | A selector in Settings |
| Home-grown | Research deferred; see section 7 |
| Plans survive re-import | Required |

### 6.2 Architecture (my call, accepted in outline)

Two halves joined by a file.

- **Importer** (Node process started by the app): reads the save and writes a **snapshot** file. It runs in a separate process with a raised memory limit (the reference parser used about 2.1 GB on a 450 MB save). It is the only part that touches the save, and it opens it read-only.
- **Planner** (the user interface): reads only the snapshot and the owner's data store. It never reads the save.

The snapshot is a derived cache that each import replaces as a whole. The owner's data store is never replaced by an import.

### 6.3 Snapshot (contract between the halves)

One JSON document containing:

- Meta: save file name, game version string (`24.3.0+0` on the sample), in-game date, managed club (id and name), import timestamp.
- For each squad (`first team`, `Reservas`, `Sub-18`): its players.
- Per player: `uid`, `id`, name, date of birth, nationality, positions (the 15 familiarity values), CA and PA, height, weight, preferred feet, the 54 attributes, contract (wage in pounds per week, end date, squad number, squad status code), home-grown club and nation (the raw relation values).

The exact schema is left to the builder, but it must be versioned and must carry the raw values so that a rule change (for example the home-grown rule) never needs a new save read.

### 6.4 Owner data store (my call: JSON file in the application data folder)

Versioned with migrations, as the prototype already does for its browser storage. Holds: per-player position marks and assigned role, plans per season (formation, slot assignments, depth bands), saved tactics, saved views and columns, team name, colours, currency, exchange rates, season-end year.

Everything user-made is keyed by player `uid`.

### 6.5 Currency

The save stores wages in pounds per week. The selector offers £, $ and €.

- £ shows the stored value.
- $ uses a default rate of **1.2492 dollars per pound**, the rate observed in the owner's game (`docs/03` section 6).
- € has no observed rate. The default is **my call** and the rate is editable in Settings, as is the dollar rate.

### 6.6 What an import does (my call)

1. Read the save, build the new snapshot, replace the old one.
2. Match owner data to players by `uid`.
3. A player in the owner's plans who is no longer in the squad stays in those plans, marked as having left the squad. Nothing is deleted automatically.
4. New players appear unassigned.
5. Plans are keyed by an absolute season (for example 2025/26), not by "current, +1, +2". A mid-season import therefore does not shift plans, and at the start of a new season the tabs move forward by one.
6. If the game version differs from `24.3.0`, show a warning and continue.

### 6.7 Display rules from the data (my call)

- "Rtg" shows **CA**. The mockup's meaning is ambiguous; changing it later touches one column.
- Default list is the first team. A toggle adds Reservas and Sub-18 (the prototype's "show U18" generalised).
- Squad status: show only the seven labelled codes (`docs/04`); other codes show nothing rather than a guess.
- A contract with no end date found shows "—".

## 7. Canteranos (deferred, shipped as an approximation)

Both KPIs ship in the first version, labelled as approximate:

- "Total": players whose home-grown club is the managed club (relation (1,72); 5 of 31 at Aberdeen).
- "Local league": players trained in the club's own country (relation (8,70); 10 of 31).

Which squads the KPIs count is **my call: the first team only**; the owner should confirm.

The owner wants the exact criterion the game uses. The research is **deferred**. What is known so far:

- Two profiles (Steven, Duncan) show two "counts for the squad-registration minimum rule" lines and each has two club-trained entries in the save (qualifiers 1 and 8). A scan of about 60 Aberdeen players shows qualifier 8 only for players aged 22 or younger trained at Aberdeen. This is a hypothesis, not a result.
- The game stores days at club and days in nation per player (Sports Interactive bug report for FM24); the day counters have not been located in the save.
- Confirming needs profile screenshots for Barron, MacKenzie, Considine, Kondolo and a player without a home-grown club.

Because the snapshot carries the raw relation values (6.3), applying the exact rule later changes only the planner's calculation.

## 8. Constraints

- The reference parser is pattern-based (no fixed record table). The extractors for contracts and relations are in Python today and must be ported to TypeScript. The port is accepted only if it reproduces the validation scores: first team 19/19 (end) and 19/19 (wage), Sub-18 19/19 and 19/19, Reservas 5/5 and 5/5 (`docs/05`).
- Validation data is from one save, one game version, one managed club (Aberdeen) for wages and end dates, and a Zstandard save only.
- The sample save is private and git-ignored. Tests that need it are integration tests that skip when it is absent.
- Windows installer built on Windows or on a Windows CI runner; development happens on Fedora.

## 9. Risks the builder must handle

| Risk | Handling |
|---|---|
| `uid` stability across two saves of the same career is **unverified** | First task: compare two saves of one career. If the `uid` is unstable, fall back to reconciling by name plus date of birth, with a manual confirmation for ambiguous cases (my call) |
| Other FM24 builds may move offsets | Check the version string; warn; validate by sanity checks (squad size, wage ranges) before accepting an import |
| Plain (uncompressed) saves untested | Test with one before release |
| Contract rule fails on unusual shapes (6,029 players without end date, 233 with an end in the past) | Show "—" and log; do not guess |
| Memory use of the importer | Separate process; report a clear error if memory runs out |

## 10. Left to the builder

User-interface framework and state management (read the prototype and choose); the snapshot and store schemas; the container-reading library for Zstandard in Node; test framework; how to show import progress; CA scale display (CA runs 1 to 200 in the game and the prototype's "Rtg" scale should be checked); error messages; the installer configuration.

## 11. Open items for the owner

1. Approve this document.
2. Confirm the first-team-only scope for the canteranos KPIs.
3. Provide the home-grown research evidence (section 7) when it is time.
4. Provide a second save of the same career to verify `uid` stability (section 9).
