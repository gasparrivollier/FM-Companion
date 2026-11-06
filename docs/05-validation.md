# 05. Validation

How each claim in 03 was checked, with the exact sample sizes. All checks use the one sample save (game date 2025-04-06, manager Theo Walcott at Aberdeen) and screenshots of the same moment in the game.

## 1. How to read this

- **Ground truth** means numbers and labels transcribed from an in-game screenshot into `tools/gt_*.json`. They are not guesses.
- A score such as **19/19** means every transcribed player matched. A single mismatch is always listed.
- The ground truth is small (a few dozen players) and comes from **one save at one patch**. A check that passes on Aberdeen's three squads and one Barcelona screen is strong evidence for the rules but not proof for every club. Section 4 says where that matters.

## 2. Results

| Claim | Check | Result | Ground truth |
|---|---|---|---|
| Container: header, manifest location, member table | Parsed the manifest and extracted members | 750 + 1,640 members; manifest 157,620 bytes parsed with **no leftover bytes**; `game_db.dat` 162.9 MB to 492,262,890 bytes | the file itself |
| Game version | `game_info.dat` string | `24.3.0+0` | the file itself |
| In-game date | Date at `game_db.dat` 36/38 and in the summary | **2025-04-06** equals the date on every screenshot | all screenshots |
| Managed manager and club | Strings in `save_game_summary.dat` | `Theo  Walcott`, `Aberdeen` | screen header |
| Outfield attributes | 36 attributes of one player, Spanish name to parser key | **36 of 36** | `gt_gartenmann.json` |
| Goalkeeper attributes | 35 attributes | **35 of 35** | `gt_profiles.json` (Mair) |
| Feet | numeric rating to label | 5 profiles consistent (20 Muy fuerte, 10 Razonable, 7 Débil) | `gt_profiles.json`, `gt_gartenmann.json` |
| Date of birth, age | 8 profiles | **8 of 8** | `gt_profiles.json` |
| Height and weight | `u16` at ability+84 and +82 | **8 of 8**; also plausible over 222,391 players (goalkeepers taller) | `gt_profiles.json` |
| Team squad | team value to team uid to page id | Reservas **5/5**, Sub-18 **19/19**, first team **19/19**; Barcelona main team and B team resolve to uid 1708 and 1668 | `gt_reservas_barca.json`, `gt_aberdeen_u18.json`, `gt_aberdeen.json` |
| Wage and end date, Aberdeen first team | `tools/fm_contracts_eval.py` | end **19/19**, wage **19/19** | `gt_aberdeen.json` |
| Wage and end date, Sub-18 | same | end **19/19**, wage **19/19** | `gt_aberdeen_u18.json` |
| Wage and end date, Reservas | same | end **5/5**, wage **5/5** | `gt_reservas_barca.json` |
| Squad number, Aberdeen | byte at rec-12 | **20/20** of the selected squad; the 35 players with a current contract have unique numbers (2 to 42; 255 = none for 5) | `gt_tactics.json` |
| Squad number, a second club | Barcelona | **16/16** of the players with a legible number (Noah Darvich's was not legible) | `gt_reservas_barca.json` |
| Event count | byte at end+14 plus 1 equals k | **33/33** current contracts | derived from the save itself, no screenshot |
| Squad status labels | code to label | 7 codes labelled (one player each, two for code 11) | `gt_profiles.json` |
| Squad selection, Aberdeen | 26 `u32` entries from offset 29 | XI (11) and substitutes (9) **exactly** equal the screen, and the **same set** in all three tactic slots | `gt_tactics.json` |
| Squad selection, Barcelona | block near offset 255,404 | XI and 12 substitutes equal the screen (after resolving registered names) | `gt_reservas_barca.json` |
| Duty byte | byte 6 of the slot block | **22 of 22** slots (tactics 1 and 2) | `gt_tactics.json` |
| Home-grown club | relation (1,72) | Aberdeen first team: **5** home-grown and the others at their real youth clubs; Barcelona: **13 of 23** equal the La Masia products | real-world knowledge, not a screenshot |
| Home-grown nation | relation (8,70) vs the nation of the home-grown club | **96%** agreement over 106,562 players with both | self-consistency in the save |

## 3. Whole-database sanity runs (no ground truth)

These show the extractor behaves sensibly outside the squads that were checked. They are **not** accuracy figures.

- Contracts: **163,738 of 222,391** players get a current contract; **157,476** are coherent (end after start and after the game date); **6,029** have no end date found; **233** have an end already in the past. 29,896 players had no club in the parser; **18,350** received one from their contract.
- Affiliate clubs: 1,553 pairs inferred (for example Barcelona Atlètic to Barcelona). Aberdeen has none.
- Height range 150 to 210 cm, weight median 71 kg with about 1.3% zeros.
- Relation table present for every player examined.

## 4. Where the evidence is thin

| Area | Why it is thin |
|---|---|
| Clubs other than Aberdeen | Only Barcelona's squad numbers and selection and one B-team case were checked. Wage and end date were checked **only at Aberdeen** |
| Contract rule on unusual shapes | The 6,029 contracts with no end date and the 233 with an end in the past have **not** been inspected one by one |
| Loans and future moves | Seen on one player (Smillie); the extractor ignores future records and does not report loans |
| Plain (uncompressed) saves | SaveLens 24 handles them; **our tools were only run on a Zstandard save** |
| Other patches of FM24 | One internal version (`24.3.0+0`); other builds could move offsets |
| Squad status | Seven labelled codes, one or two players each |
| Role bytes | Disproved candidate removed; no reliable decode |
| Home-grown qualifier | Not understood |
| Display rounding | The screen rounds wages, so a "wage matches" check is within about 3%, not exact; the stored value is exact |

## 5. Catalog of ground-truth files (`tools/`)

| File | Screenshot | Content | Used for |
|---|---|---|---|
| `gt_aberdeen.json` | Aberdeen squad view (columns Edad, Sueldo, Final) | 19 first-team players: wage, contract end | contract wage and end |
| `gt_aberdeen_u18.json` | Aberdeen Sub-18 squad view | 19 players: age, wage, end | youth contracts; team value |
| `gt_reservas_barca.json` | Aberdeen (Reservas) squad view and Barcelona tactics screen | 5 reserve players; Barcelona XI and substitutes with squad numbers | team value; second-club squad numbers; AI selection |
| `gt_tactics.json` | three Tactics screens (tabs 1, 2, 3) and the role popup | XI with role and duty per slot for each of the 3 tactics, substitutes, squad numbers, instruction lists | selection, duty byte, role names |
| `gt_gartenmann.json` | Gartenmann's profile | attributes, contract, height, weight, status, history | attributes (36), contract line |
| `gt_profiles.json` | profiles of Smillie, Bardsley, Cook, Muñoz, Papela, Mair, Considine (Gartenmann included) | height, weight, status label, bonus and clause counts, team shown, goalkeeper attributes | height, weight, status, team |
| `gt_papela.json` | Papela's career statistics | career table and 2024/25 by competition | statistics attempt (failed) |
| `gt_stats.json` | squad view (apps, goals, minutes) | 19 players | statistics attempt (failed) |
| `gt_premiership_stats.json` | league statistics page | top lists and a 13-player table | statistics attempt (failed) |

The screenshots themselves are not stored in the repository (they were provided in the conversation); the JSON files are the durable record. They contain names and numbers only, no save data.

## 6. Independence of the checks

- The **attribute, CA, PA, name and date-of-birth** reading is SaveLens 24's work, and our checks confirm it on 8 players; SaveLens's own validation used 62 real saves and two FMRTE exports.
- The **contract, team, selection, status, height and weight, relations** decoding is ours, validated only against the screenshots above and against the file's own internal consistency.
- The **home-grown relation** was validated against facts about real clubs (a source independent of the game's UI).
