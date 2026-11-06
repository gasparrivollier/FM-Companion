# 08. Limits, risks and open questions

An honest list of what is not known, what could break, and what was deliberately left alone.

## 1. Scope of the evidence

| Limit | Detail |
|---|---|
| **One save** | everything was derived and checked on a single career save at game date 2025-04-06 |
| **One patch** | internal version `24.3.0+0`, last written by `24.4.2`; offsets can move in other builds. SaveLens 24 rejects FM23 (`23.4.0+0`) saves and its authors tested only FM24 `24.3` |
| **One compression kind** | our tools were run on a Zstandard save only; plain saves are supported by SaveLens 24 but were never run through the container tools here |
| **One manager club** | wage and end-date accuracy is proven for Aberdeen's three squads; only squad numbers, selection and one B-team case were checked at Barcelona |
| **Spanish UI** | labels in the glossary come from a Spanish game; the English names are informal translations |
| **Display rounding** | wage comparisons are within about 3% because the screen rounds |

## 2. Fragile parts

| Part | Risk |
|---|---|
| Player and club reading | depends on SaveLens 24's pattern-based parser (no fixed record table exists). It had 0 ambiguous and 0 unbound blocks on the sample and on SaveLens's 61 saves, but it is a heuristic. It **reads the team table one row off**, so its `clubId` can be wrong or null |
| Contract extractor | rule-based; scored 19/19, 19/19 and 5/5 on three squads. **6,029 players** have a current contract with **no end date found** and **233** an end in the past; these were not inspected one by one. The affiliate rule infers club relations from data and could misjudge small leagues |
| Club recovery for club-less players | uses a vote over linked players; a club with few linked players could be mapped wrongly (an early version attributed Aberdeen's youth to Motherwell before the voting was made robust) |
| Squad-selection reading | the XI is in the game's **internal slot order**; a mapping from slot order to each formation's visual slots is **not built** and differs between formations (Aberdeen's 4-3-3 stores Barron before McGrath; the 5-3-2 is ordered differently again) |
| Tactics tables | five copies per tactic; only the first (managed first team) was identified; header fields beyond the team id and manager id are unknown |
| Uid stability | the same player's `uid` across **different saves of the same career** was not checked; fmsave's FM26 notes warn that created people can reuse deleted people's ids |

## 3. Not obtained (and why)

### 3.1 Season and career statistics

Appearances, goals, assists, minutes, average rating, xG, xA, per-90 values, career history rows.

What was tried:
- `pl_hist_ls.dat` (a list of byte offsets into `pl_hist_dt.cmt`, pointing 8 bytes before each row's year pair; about 2.05 million entries). Rows are 40 bytes: year pair, a flag, two count bytes (255 = none), club-like references, dates. **Only completed seasons** are there (2024: 6 rows; 2023: 4,141; 2022: 21,977). Papela's seven completed seasons were not located (club references do not map to the club uids or ids tried).
- `player_stats_hist_dt.cmt` (122 MB): one record (Papela's) matched his season totals (2,043 minutes, starts 16, subs 22, goals 4, assists 5, yellow cards 3), but the same offsets failed for the other 18 players, and ten candidate records for Mohanad Ali had inconsistent layouts. **That one match may be partly coincidence.**
- Decimal values (xG, xA, ratings, per-90) were **not found** anywhere near it, as float32 or as scaled integers. They are probably **computed from per-match records**.

What to try if statistics ever matter: the per-match data (about 330 `.apm` and 340 `.scm` members, `match_stats_cfg.dat` at 66 MB, `play_fixture_manager.dat`), with three or four players' complete per-season tables as ground truth. This is a separate and larger effort.

### 3.2 Tactics

- **Role identity.** The same displayed role gives different bytes in different slots. Duty is decoded (byte 6).
- **Instructions, mentality, fluidity**, and the **role suitability stars** (computed by the game).
- What would help: several tactics where only one thing changes at a time (one role changed, one instruction toggled), saved as separate saves, so a byte-level diff isolates the field. `fm-toolkit` ships a differ for this purpose.

### 3.3 Contracts

- **Bonuses and clauses** (the "Primas / Cláusulas" counts): variable-length table, not at a fixed offset.
- **Net wage**: computed from tax bands, not stored.
- **Transfer value range** ("$2.2M - $3M"): not located.
- **Pending moves and loans** are in the chain but are not reported (the extractor ignores future-dated records and limits to the player's own and affiliated clubs).

### 3.4 Smaller unknowns

| Item | State |
|---|---|
| Squad status codes 0, 1, 7, 10, 20 | no labels; seven codes are known |
| Home-grown relation **qualifier** (values 1, 2, 5, 8, 10) | meaning not understood; blocks the exact "club-trained" rule |
| Other relation pairs ((1,3), (1,4), (3,1), (3,2), (7,18), (4,25), (4,67), (1,106), (1,105)) | named only from FM26 documentation; **unverified** in FM24 |
| Team-head `type` bytes 19, 20, 21, 23 and the `flag` byte | meaning unknown (18 = the Sub-18 team) |
| `tactics_man.dat` header fields at offsets 8, 15, 23 | meaning unknown |
| AI teams' selection header (team id) | not read |
| Reputation stars, condition, injury risk, form, morale, dynamics, sanctions | not located |
| Staff (coaches, scouts, physios, the human manager) | not exposed by the parser; not examined |
| The 15th position `SW` | present in the save, never displayed in the screenshots |
| The `.apm` and `.scm` members | not examined |

## 4. Facts that constrain a future design (not decisions)

- A save is **450 MB** here (SaveLens 24 reports 1.28 GB for the largest of 62 saves); the main database is **492 MB** decompressed.
- The parser needs **about 2.1 GB** of memory in Node on this save and about 16 seconds; SaveLens's own native (Rust) reader reports 7.3 seconds and 773 MB on its largest save.
- The data the mockup needs for one squad is small (about 31 players), but finding it requires reading the whole player table (222,391 players) because the team and the contract records are located by structure, not by index.
- Reading is **read-only**: our tools open the save in read mode and never write to it (we did not hash the sample before and after). SaveLens 24 hashes its inputs before and after parsing and found no change on its 62 saves.
- The save is the user's private career data. SaveLens and fmsave both process **locally** and never upload; that is the established norm.
- Both fmsave and SaveLens expose hidden values (CA and PA are visible in the save). fmsave warns that using hidden data to gain an advantage in a **shared online career** may break platform or community rules; FM24 Companion is a single-player tool.

## 5. Suggested next research steps, if wanted

In rough order of value for the mockup:

1. **More clubs as ground truth** for the contract rule: one or two other clubs' squad views (wage, contract end) to confirm the rule outside Aberdeen, and one **league whose clubs have B teams or loans**.
2. **Inspect the 6,029 contracts with no end date** and the 233 with an end in the past (a script listing a sample, then a few screen checks).
3. **Label the remaining status codes** (0, 1, 7, 10, 20) with a few more contract screens; ter Stegen (1) and Peña (20) at Barcelona are ready candidates.
4. **Build the slot mapping** from the selection's internal order to each formation's visual slots (needs the formation tables, not yet located).
5. **Check `uid` stability** across two saves of the same career (a second save of the same game a few days later).
6. **Plain-save check**: run the container tools on an uncompressed FM24 save.
7. Tactics diff experiments, and statistics from the per-match data, only if those features are wanted.

## 6. Decisions deliberately **not** taken here

No architecture, language, framework, hosting or storage choice was made. No code for the application was written. The tools in `tools/` are research instruments.
