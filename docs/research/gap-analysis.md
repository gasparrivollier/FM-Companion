# Gap analysis: mockup needs versus what is mapped in the save

> **Working log.** This file is the chronological record of the research session (what was tried, in order, including dead ends and corrections). For reference use the structured documents [`docs/README.md`](../README.md) and 02 to 08. Where this log and those documents disagree, the structured documents are right.


Date: 2026-11-03. Inputs: `docs/01-design-functionalities.md` (what the mockup needs), `docs/research/fm24-save-files.md` and `fm24-data-model.md` (what is mapped), the user's screenshot of the in-game squad view (Aberdeen, 6 Apr 2025). Research only, no implementation.

Status key:
- **DONE**: decoded from the save and checked against ground truth.
- **DERIVABLE**: computable from data already decoded.
- **PARTIAL**: decoded but only validated on part of the data.
- **OPEN**: located or documented elsewhere (FM26) but not decoded for FM24.
- **APP**: lives in the app, not the save (user-defined), so no gap.
- **DROP?**: not obtainable from the save; needs a product decision.

## 1. Per-player data (mockup squad table, candidate list, player detail)

| Mockup field | Source in the save | Status | Evidence / note | To close it, I need |
|---|---|---|---|---|
| Name | name pools in `game_db.dat` | **DONE** | 222,391 players parsed, no warnings | nothing |
| Age (and +1 per planned season) | date of birth + in-game date (`game_db.dat` offsets 36/38) | **DONE** | date 2025-04-06 matches the game; Aberdeen ages match the screenshot | nothing |
| Natural positions | 15 position ratings, 1-20 | **DONE** (data), **decision** (threshold) | ratings read for all players; SaveLens lists a position at rating 15 or more | your call: what counts as natural (20 only?) and as "cubre" |
| "Cubre" positions | same 15 ratings | **DERIVABLE** | e.g. McNamara DC 17, DR 20, WBR 20 | same decision as above |
| Wage per week | `u32` at tag+17, GBP per week | **DONE** for Aberdeen first team (18/18 readable) | convert with the game's rate (about 1.249 USD per GBP; stored × 64.96 gives $ per year) | screenshots of other squads to validate |
| Contract expiry | date at tag-9-29k | **DONE** for Aberdeen first team (19/19) | see section 12 of the save-files doc | same |
| Contract start | date at tag-19 | **PARTIAL** | extracted for all, not compared to the screenshot (the screenshot doesn't show it) | a screenshot that shows join date or contract start |
| "Rtg" (rating column) | ambiguous in the mockup | **DECISION** | candidates: CA (**DONE**), role-fit score from attributes (**DERIVABLE**, SaveLens has formulas), season average rating (**OPEN**) | your definition of Rtg |
| Season stats (appearances, goals, assists, minutes, average rating) | `player_stats_hist_dt.cmt`, `pl_hist_dt.cmt` | **OPEN** | not decoded; FM26 stores them in an equivalent history table | the screenshot already gives ground truth (see section 3); I can decode now |
| Role (tactical role per slot) | chosen by the user in the app | **APP** | the mockup's role list (about 5-8 per position) is static | optional: verify the Spanish role names against the game |
| XI slot, depth bands, custom tactics, views, team name, colors | chosen by the user in the app | **APP** | stored in the browser in the prototype | nothing |

## 2. Squad and club level

| Mockup need | Source in the save | Status | Note | To close it, I need |
|---|---|---|---|---|
| Which club is mine | managed club: `manager_manager.dat` / `humans.dat` | **OPEN** | the save name suggests Theo Walcott at Aberdeen; not decoded | nothing, I can search for the manager by name; you confirm Aberdeen is the managed club |
| Squad membership (who is in my squad) | player → team → club link | **DONE** for the club (36 Aberdeen players) | but a club has several teams: first team, reserves, under-18; the screenshot's sidebar shows "Reservas" and "Sub-18" | a screenshot of Aberdeen's Reserves and Sub-18 squads, to separate teams |
| Season label and "year the season ends" | in-game date | **DERIVABLE** | 2025-04-06 means season 2024/25, ends 2025 | nothing |
| Team name | club name | **DONE** | "Aberdeen" | nothing |
| Team colors | club kit colors | **DROP?** | not in the save that I know of (FM26 keeps kits in the game database, not the save) | decision: keep the manual color picker |
| Currency | wages stored in GBP | **DONE** | convert on display using the in-game rate | decision: which currencies to offer |
| Squad planner / current XI from the game | squad planner ids in `manager_manager.dat`, tactics in `tactics_man.dat` | **OPEN** | the screenshot's "Posición" column (MPI, MC, DFD, S1..S9...) is the game's own squad plan. Importing it could pre-fill the mockup's XI and depth bands | a screenshot of the in-game Tactics screen and of "Plan de plantilla", so I can verify against the real XI and subs |

## 3. KPIs (placeholders in the mockup)

| KPI | What it needs | Status | To close it, I need |
|---|---|---|---|
| Canteranos, whole squad | which players came through the club's youth system | **OPEN** | FM26 stores a "home-grown club" relation per player (relation pair `(1,72)`); not found for FM24 yet | your definition: academy product, or home-grown under the league's rule? Then a few known Aberdeen academy players as ground truth (names only) |
| Canteranos, local league | the same, plus the club's and player's nation | **DERIVABLE** for nationality (nation ordinal read for players; clubs carry a nation) | the academy part is the same open gap | same |

## 4. Data available in the save that the mockup does not use yet

Not gaps, but candidate features to decide on later:
- Full attributes (62), CA and PA, personality, hidden attributes (**DONE**).
- Role-fit ratings per role and duty (SaveLens ships formulas; **DERIVABLE**).
- Shortlist (`shortlist_man.dat`), injuries (`injury_manager.dat`), morale, transfers, finances, training, news (all **OPEN**).
- Players of every other club (222k in the save), useful for a "who could replace him" view.

## 5. What I need from you, in priority order

1. **A screenshot of the squad view with the stats columns and the same date** is already enough to start decoding season stats. The screenshot you sent has appearances, starts, goals, assists, minutes, "last 5 games" rating and a "VALENT" column. Please tell me what "VALENT" and the small badges ("Rea", "Fic", "Prc", "PrF", "Des") mean, so I can map them.
2. **A decision on "Rtg"**: CA, role-fit score, or season average rating.
3. **Screenshots of Aberdeen's Reservas and Sub-18 squads** (same columns), to separate teams and to validate the youth contract shape (the one still failing for about 51,000 players).
4. **A screenshot of the in-game Tactics screen** (starting XI and subs) and of "Plan de plantilla", to decode the squad plan if you want the app to import it.
5. **Your definition of "canteranos"** and 3 to 5 Aberdeen players you know are academy products.
6. **Screenshots of one or two other clubs' first squads** (any club, same view), to confirm the contract rule outside Aberdeen.
7. Decisions that need no data: position thresholds (natural / cubre), currency options, whether team colors stay manual.

## 6. What I can do without anything new

- Find the managed club (look for Theo Walcott in the manager members).
- Start decoding season stats using your screenshot as ground truth (Muñoz, for example: 36 (2) appearances, 36 starts, 9 goals, 11 assists, 2,682 minutes).
- Locate squad status and squad number bytes near the contract record.
- Measure how the player-to-team link separates first team from reserves.

---

## Update (later on 2026-11-03): where the gaps stand

| Mockup need | Was | Now |
|---|---|---|
| Wage, contract expiry, squad number | partial (Aberdeen first team only) | **Decoded and verified** on 3 Aberdeen squads (57 players) and one other club; `tools/fm_contracts.py` |
| Which club is mine | open | **Decoded** (name and date in `save_game_summary.dat`; team id 1310 and manager id in `tactics_man.dat`) |
| Squad membership including youth and reserve squads | partial | **Solved by inference** from the contract's club reference (parser leaves them club-less); Reservas and Sub-18 are teams inside the club and are not yet told apart from each other or from the first team |
| Squad plan (XI, bench) | open | **Decoded** for Aberdeen (3 tactics share one selection) and confirmed on Barcelona |
| Role and duty per slot | open | **Not decoded** (duty bit known; role identity unsolved) |
| Squad status label | open | **Seven codes labelled** (2, 3, 4, 5, 11, 13, 21); 0, 1, 7, 10 and 20 still unlabelled |
| Season statistics, average rating | open | **Not decoded** (deprioritised, not needed by the mockup) |
| Canteranos, home-grown | open | **Decoded**: relation (1,72) = home-grown club, (8,70) = home-grown nation; verified on Aberdeen and Barcelona. Needs the user's definition of the second KPI ("liga local") |
| Team colours | drop? | unchanged |
| Position familiarity (natural / cubre) | derivable | unchanged; parser's 15 ratings verified (also foot ratings, attributes) |

First team, Reservas and Sub-18 are now **separated** by the team value in each player's ability block (section 20 of the save-files doc): 1310, 65414 and 65416 for Aberdeen.
