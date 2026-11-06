# Research: FM24 save files as the app's input

> **Working log.** This file is the chronological record of the research session (what was tried, in order, including dead ends and corrections). For reference use the structured documents [`docs/README.md`](../README.md) and 02 to 08. Where this log and those documents disagree, the structured documents are right.


Date: 2026-11-03. Scope: research only, no architecture or code decisions.
Confidence labels: **[verified]** read in a primary source (repo doc or README) this session; **[reported]** from a search summary I did not open; **[inferred]** my reasoning; **[unknown]** not found.

## 1. Summary

1. FM24 saves are `.fm` files, a proprietary container. The format has been reverse-engineered by the community, and there are **working FM24 readers**. We should not write our own decoder from scratch.
2. The two big open-source projects (`fmsave`, `fm-toolkit`) target **FM26/27**. They are not FM24 readers, but they are the best documentation of the shared container design.
3. The only open FM24 save readers found are **FM SaveLens 24** (open source, Rust/TypeScript, no license) and **FMBR24** (binaries only, closed source). Both are young one-person projects.
4. **Key gap:** SaveLens 24, the most documented FM24 reader, explicitly does *not* expose contract values (wage, expiry), injuries, or transfer data. Our design needs wage and contract expiry. No known open tool is confirmed to read them from an FM24 *save*.
5. The game's own table export (Ctrl+A, then Ctrl+P, then Web Page) is a working fallback and is what the prototype's importer already parses.

## 2. The `.fm` container

Mostly **[verified]** from FM SaveLens 24 `docs/FORMAT.md`, Gilet `SAVE_FORMAT.md` (FM26) and fm-toolkit docs (FM26).

- 26-byte header starting with `02 01 66 6d 66 2e` (`\x02\x01fmf.`).
- **FM24:** header byte 25 is the compression flag: `0` = plain, `3` = Zstandard. Both exist in the wild (SaveLens validated 53 plain and 8 Zstd FM24 saves). **FM26 appears to be always Zstd** (Gilet), so detection must be per-file.
- The file is an **archive of named members** (`game_info.dat`, `game_db.dat`, `humans.dat`, `shortlist_man.dat`, `tactics_man.dat`, and others). A manifest locates members by offset, stored size and uncompressed size. FM24 needs a "FM24 adjustment" in how the manifest pointer at header +9 is read (SaveLens `archive.ts`). It is not identical to FM26.
- FM26 saves are a sequence of back-to-back Zstd frames. One frame is one member, and a trailing manifest frame names them (Gilet). Member frames start with `03 01 "tad."`. **[inferred]** FM24 compressed saves likely use the same framing, but only SaveLens' reader confirms the details.
- Internal version string: **`24.3.0+0`** for the FM24 saves SaveLens supports. FM23 (`23.4.0+0`) saves are rejected. Other FM24 patch builds are untested. **[unknown]** whether early FM24 builds (24.1, 24.2) share the layout.
- Only `game_info.dat` and `game_db.dat` matter for squad data. The rest can be skipped, which saves memory.
- Sizes: a 1.28 GB FM24 save exists; a Zstd save is far smaller on disk. SaveLens imported its largest (68,965 players) in about 7.3 s with about 773 MiB peak RAM (native Node/Rust, not a browser).
- Game date: FM24 `game_db.dat` offsets 36 and 38; dates of birth use one-based day-of-year.

## 3. Player data in an FM24 save

**[verified]** (SaveLens FORMAT.md, validated against FMRTE exports and screenshots):

| Data | Status |
|---|---|
| Names (first/surname/common-name pools, single-name players like Davinchi) | read; pool IDs with `0xffffffff` as "missing" |
| Public UID and source UID (can differ in edited databases) | read |
| CA and PA | u16 at attribute-block offsets -38 and -36 |
| 15 position bytes before the attribute block | read (these are per-position ratings, the basis for "natural" and "covers") |
| 54 playing, hidden and foot attributes (raw 1-100; shown value `max(1, min(20, round(raw/5)))`) | read |
| 8 personality attributes (already 1-20) | read |
| Date of birth | read |
| Primary nationality (internal ordinal, 0 = Algeria) and tagged secondary citizenship | read |
| Club (via team ordinals, with youth/reserve team handling) | read; unknown links stay empty |

**Explicitly not exposed by SaveLens:** contract values, transfer costs, injuries, preferred moves. Ratings are not estimated from CA/PA.

Pitfalls the SaveLens authors hit, worth remembering:
- Requiring public UID = source UID drops players added by edited databases and can attach the next player's attributes to the wrong person. Attribute blocks must be matched by entity ID ownership, not by proximity.
- Do not copy FM26 offsets. They are hypotheses to re-verify on FM24 files.
- The third name reference can be a second surname, not a common-name index.

## 4. What the design needs versus what is known to be readable

| Design field | In FM24 save per known tools? |
|---|---|
| name, age (from DOB + game date), positions, club | yes (SaveLens) |
| CA/PA, attributes | yes, useful for role-fit and "rating" ideas |
| **wage / week** | **no confirmed FM24 save reader.** FM26: fmsave reads `contract.wage` (also fm-toolkit's contract decoders). FM24 live-memory layout (fm-editor) shows a contract record with wage as i32 per week at +0x18, expiry at +0x40, squad status at +0x4C, squad number at +0x55. This is memory layout, not save offsets, but it hints that the record exists and is a candidate to locate in the save **[inferred]**. |
| **contract expiry** | same as wage |
| average match rating | FM26: `player_season_stats()` in fmsave. FM24: **[unknown]**. SaveLens skips match-history members. `pl_hist_*` career history members exist in FM26 (fm-toolkit) and probably FM24. |
| **managed club (which squad is mine)** | FM26: `managed_clubs()` in fmsave and `manager_manager.dat` in Gilet. FM24: **[unknown]**. SaveLens imports all players and lets the user filter by club. |
| academy / home-grown ("canteranos") | FM26 fm-toolkit decodes the relation pair `(1,72)` Home-Grown Club in the person block. FM24: **[unknown]** |
| squad status, squad number, current tactic and lineup | FM26: `tactics_man.dat` selectors resolved (fm-toolkit). FM24: **[unknown]** |

## 5. Landscape of existing projects

| Project | Targets | What it gives | License / source | Notes |
|---|---|---|---|---|
| [FM SaveLens 24](https://github.com/MSalman5230/FM-SaveLens-24) (MSalman5230) | **FM24 `24.3.0+0`**, plain or Zstd | Players, attributes, CA/PA, positions, role ratings; desktop (Tauri) and browser mode; read-only; has format and validation docs | **No license file** (default copyright; an open issue asks about reuse). Updated 2026-09-06 | **Best FM24 reference.** Docs are readable as research; the code cannot be copied without permission. Rust parser in `native/parser/`: `archive.rs`, `records.rs`, `attributes.json` |
| [FMBR24](https://github.com/acidtwin/FMBR24) (acidtwin) | FM24, Linux, PyQt6 | Save viewer/editor | **Binaries only; source not published** | Uses zstandard and numpy per the install notes **[reported]**. Updated 2026-10-11 |
| [fmsave](https://github.com/rhiever/fmsave) (rhiever) | FM26, FM27 | 30 readers (players, contracts, finances, fixtures, tactics, season stats...), CSV/JSON export, a **browser app that reads the save locally** | **MIT**, active (pushed 2026-11-03) | Not FM24. Best-documented structure and a "trust" guide on verified versus unconfirmed fields. Python 3.12+ |
| [fm-toolkit](https://github.com/spadesM/fm-toolkit) (spadesM) | FM26 saves; FM23/24/26 game databases | Vendors fmsave, adds 81-section unpacker, hidden fields, SQLite export, a byte-level save differ. Docs: format, 81 sections, schema | README says MIT; GitHub reports `NOASSERTION`. Active | Very detailed but self-described reverse engineering with heavy claims, so verify before relying on it. Its `diff` tool is useful for discovering FM24 offsets |
| [Gilet](https://github.com/fifteen15-labs/gilet) (fifteen15-labs) | FM26 | Thorough `SAVE_FORMAT.md` (container, manifest, dates, names, players); SaveLens used it as its starting clues | **No license** | Best prose spec of the container and manifest; read as research |
| [fm-editor](https://github.com/barak14/fm-editor) (barak14) | FM24, 26, 27 live memory | Real-time editor attached to the running game; `docs/fm24/memory-layout.md` lists entity arrays and player/contract field offsets (83,426 players, 33,835 staff, 36,725 clubs on a fresh save) | Open source (Rust) | Edits live memory, which is not our use-case, but the FM24 field map (contract, nationality, caps, traits) is useful ground truth for save decoding |
| [fmm-stats](https://github.com/ZacHooper/fmm-stats) | FM **Mobile** 2022 `.fms` | Read-only extraction to JSON/CSV | none | Different product. Only useful as a methodology example |
| FM24 Save Data Center (ZizonK7/fm24) | FM24 `24.3.0+0` | Local data center, SQLite, JSON/CSV export; Korean README | none | Small personal project; it confirms `24.3.0+0` is the common build |
| Genie Scout, FMRTE | FM24 (memory-based) | Established commercial/free tools | closed | They read the running game's memory, not the save. SaveLens validated its output against FMRTE exports. Not used as a dependency by SaveLens |

Not found: a maintained, licensed, FM24-targeted library that decodes a save into wage/contract data.

## 6. The in-game export route (fallback and baseline)

**[reported]**, from community guides found in search:
- In the squad screen: select all rows with Ctrl+A (otherwise only about 200 rows export), then Ctrl+P (or FM > Print Screen) and choose **Web Page** to save an `.html` table. Custom views (`.fmf` view files) live in `Documents/Sports Interactive/Football Manager 2024/views`.
- No source mentioned a native CSV export in FM24. One comment says FM26 removed HTML export.
- This route gives exactly the user-facing columns (wage, contract, average rating, position text) in the user's game language, with no reverse-engineered format risk. The prototype's importer already targets it. Its limitation is that the user has to export manually and keep the view columns correct.

## 7. Save file location and handling

- FM26 per fmsave: macOS `~/Library/Application Support/Sports Interactive/Football Manager 26/games/`; Windows usually `Documents\Sports Interactive\Football Manager 26\games\`; Steam Cloud and other stores may use other locations. **[inferred]** for FM24 the same pattern with `Football Manager 2024`. **To verify on a real install**, including Linux/Proton (the user runs Linux, and fm-editor documents FM24 running under Proton).
- Never read a save the game is writing: copy first (fmsave advice). SaveLens hashes sources before and after parsing and found no modification.
- Autosaves, backups and `(v02)`-style versioned files exist in real collections. Save naming and the "latest save" choice are product questions for later.
- Saves can contain third-party edited databases, which changes IDs (see section 3 pitfalls).

## 8. Risks and constraints

- **Version fragility:** any patch can move offsets (fm-editor says so; fmsave pins to a build and refuses unknown layouts). FM24 is a closed game version, so this risk is mostly bounded, but the user's patch level (24.3 versus other builds) must be detected and reported.
- **Legal/licensing (decision 2026-11-03: not a concern, this is a personal project, so existing code may be read, adapted and reused freely; keep attribution as good practice):** SaveLens and Gilet carry no license; FMBR24 is closed. Reusing code is not permitted without author permission. Reading their *documentation* as research and re-deriving offsets from our own saves is the safe path. fmsave (MIT) can be adapted with attribution but targets another game version. These projects state they are unofficial and unaffiliated with Sports Interactive/SEGA.
- **Data volume:** a save holds 60-70k players. The app needs only the managed club, so reading everything may be unnecessary, but locating the club requires the full person/club tables.
- **Privacy:** SaveLens and fmsave both stress local-only processing. fmsave also ships a drop-a-save browser reader that never uploads. The user wants to "upload or point to" a file; local processing is the established norm.
- **Rule/ToS note:** fmsave warns that hidden data (CA/PA) could break platform or community rules in shared online careers; this is a single-player tool.
- **Validation ground truth:** SaveLens validated against FMRTE exports and in-game screenshots. We need our own reference saves and matching in-game or exported tables to confirm every field we decode.

## 9. Open research questions (next research steps, not decisions)

1. Open SaveLens `native/parser/records.rs`, `archive.rs`, `attributes.json` and `research/` scripts as **documentation** to map the FM24 record layout (blocked from copying; fine to read).
2. Check fm-toolkit's section schema (`FM26_SAVE_DATABASE_SCHEMA_AND_81_SECTIONS.md`) and the `PersonBlockLayout` notes for the FM26-to-FM24 delta (fm-toolkit reports a +1-byte person block shift between FM26 and FM27, which hints at what changes between versions).
3. Find where contracts, season stats, managed club, tactics and shortlist live in an **FM24** save. This needs a real FM24 save. Ask the user for a sample save (the user's own, privately) to use `fm-toolkit diff`-style analysis on.
4. Ask the maintainers of SaveLens 24 (open issues) whether contract data is planned or documented, and about licensing for reuse.
5. Check whether FM24 uses the same `rgman`-style competition sub-archive as FM26.
6. Confirm the FM24 save folder on Linux/Proton and Steam Cloud behaviour.
7. Decide, later, whether the first version relies on the table export, the save file, or both. This is a product call, not made here.
8. Check the language dimension: how FM stores position/role identifiers, so the UI language is independent of the game language.

## Sources

- FM SaveLens 24: [repo](https://github.com/MSalman5230/FM-SaveLens-24), [FORMAT.md](https://github.com/MSalman5230/FM-SaveLens-24/blob/HEAD/docs/FORMAT.md), [VALIDATION.md](https://github.com/MSalman5230/FM-SaveLens-24/blob/HEAD/docs/VALIDATION.md), [licensing issue #15](https://github.com/MSalman5230/FM-SaveLens-24/issues/15)
- [FMBR24](https://github.com/acidtwin/FMBR24)
- [fmsave](https://github.com/rhiever/fmsave) and its [docs](https://rhiever.github.io/fmsave/)
- [fm-toolkit](https://github.com/spadesM/fm-toolkit) and its docs folder
- [Gilet SAVE_FORMAT.md](https://github.com/fifteen15-labs/gilet/blob/main/docs/SAVE_FORMAT.md)
- [fm-editor](https://github.com/barak14/fm-editor) and [FM24 memory layout](https://github.com/barak14/fm-editor/blob/main/docs/fm24/memory-layout.md)
- [ZizonK7/fm24](https://github.com/ZizonK7/fm24), [ZacHooper/fmm-stats](https://github.com/ZacHooper/fmm-stats)
- FM export guides via search: [FM Scout FM23 spreadsheet utility](https://www.fmscout.com/a-fm23-multi-functional-spreadsheet-utility.html), [FM-Arena threads](https://fm-arena.com/find-comment/29931/), [r/footballmanagergames squad assessment spreadsheet (FM24)](https://lr.sudovanilla.org/r/footballmanagergames/comments/17hkiip/fm_squad_assessment_spreadsheet_v7_fm24_ready)
- Local copies of the fetched READMEs and docs are in the session scratchpad (not part of the repo).

## 10. First look at a real FM24 save (2026-11-03)

Sample: `saves/Theo Walcott - Aberdeen - Canadá.fm` (454,368,930 bytes, git-ignored). The save name suggests manager Theo Walcott at Aberdeen, with Canada as the nation or save label. **[verified]** by direct inspection of the file (read-only, Python 3.14 stdlib `compression.zstd`):

- Header: `02 01 66 6d 66 2e 08 00 00 | 0d 7b 14 1b 00 00 00 00 | 11 00 00 00 00 00 00 00 | 03`. Byte 25 = `3` → Zstandard. The little-endian u64 at +9 is `454,327,053`.
- **Manifest location:** at file offset `9 + ptr` there is a 9-byte trailer header (`02 01 'fmf.' 08 00 00`), followed by a Zstd frame at `9 + ptr + 9`. It runs to the end of the file and decompresses to 157,620 bytes. This matches fm-toolkit's FM26 description, so **FM24 and FM26 share the same container and manifest design** for this build, at least for Zstd saves.
- **Manifest layout** (same as Gilet's FM26 spec): length-prefixed save name, u32 top-level member count, then per member: name parts (`name`, then an extension part starting with `.`), u64 offset (relative to byte 26), u64 stored size, u64 plain size, 16 bytes of stamps. Then u32 sub-archive count, with sub-archive `rgman` (1,640 children), then a zero terminator. Parsed cleanly with no leftover bytes.
- **750 top-level members:**
  - about 80 `.dat` and `.cmt` subsystem files;
  - about 330 `.apm` and about 340 `.scm` files, whose purpose is unknown (named like `<id>_<n>[_<n>]`);
  - the whole save has 750 + 1,640 = 2,390 members.
- **Largest members** (stored → plain): `game_db.dat` 162.9 MB → 492.3 MB; `player_stats_hist_dt.cmt` 31 MB → 121.5 MB; `pl_hist_dt.cmt` 16 MB → 72.4 MB; `match_stats_cfg.dat` 66.5 MB; `tc_record_man.dat` 52 MB plain; `person_record_history_dt.cmt` 44 MB plain; `transfer_man.dat` 34.5 MB plain.
- **Subsystems relevant to the design are separate, small members**, which can be decoded without touching the 492 MB main database: `contract_man.dat`, `tactics_man.dat`, `shortlist_man.dat`, `manager_manager.dat`, `scout_man.dat`, `finance_manager.dat`, `training_man.dat`, `injury_manager.dat`, `captain_system.dat`, `morale_manager.dat`, `feeder_man.dat`, `humans.dat`, `save_game_summary.dat`, `game_info.dat`. Player-level season stats live in `player_stats_hist_dt.cmt` and `pl_hist_dt.cmt`.
- Gotcha: reading the file by repeatedly slicing the whole mmap per frame is quadratic and timed out. Use the manifest offsets and bounded reads.

What this changes in the open questions (section 9):
- Q5 (rgman sub-archive in FM24): **answered yes**, 1,640 children.
- The "FM24 adjustment" to the manifest pointer that SaveLens mentions is consistent with the layout above (pointer + 9 for the trailer header, + 9 more for the frame).
- Still **unknown**, now ready to investigate on this file: where wage, contract expiry, squad status, managed club and average ratings sit (candidates: `game_db.dat`, `contract_man.dat`, `manager_manager.dat`, `player_stats_hist_dt.cmt`).

## 11. Exploding the sample save with the FM24 reference parser (2026-11-03)

**Method.** Cloned FM SaveLens 24 into `vendor/FM-SaveLens-24` (git-ignored). Rust is not installed on this machine, so I ran its **TypeScript reference parser** (`server/parser/`) directly with Node 22 (type stripping works, only `node:` built-ins are needed). Runner: `tools/savelens-dump.ts`.

```bash
node --max-old-space-size=6000 tools/savelens-dump.ts "saves/<save>.fm" out/save.json
```

Result: parsed in about 16 s, peak RSS about 2.1 GB, zero warnings, zero ambiguous or unbound ownership blocks. Output is 340 MB of JSON (git-ignored `out/`), so a full dump is a development artifact, not something to ship.

**What the sample contains** (**[verified]**, parser output, `formatVersion` `24.3.0+0`):

| Item | Value |
|---|---|
| In-game date | **2025-04-06** |
| Person records / identities | 397,847 / 397,751 |
| Players (ability blocks) | 222,391 |
| Clubs / teams / club links | 50,801 / 115,941 / 192,495 |
| Players with no club | 29,896 |
| Clubs with at least one player | 16,479 |
| Age range | 15 to 54 |
| Aberdeen (club id 1122, uid in club table) | 36 players, plus 2 at "Aberdeen East End" (club id 3972, a different club) |

Aberdeen's squad, top by CA: Connor Barron (22, CA 128/PA 135, DM MC), Joaquín Muñoz (26, 128/139, ML MR AML AMR), Carl Rushworth (23, 125/148, GK), Luan Patrick (23, 120/136, DC), Slobodan Rubežić (25, 120/129, DC), Leighton Clarkson, Michael Obafemi, Danny McNamara, and others. This matches the real-life Aberdeen squad of that period, which supports that club linkage and names are right. Full list: `out/aberdeen.json` (generated, not committed).

**Per-player fields the parser yields** (`Player` type): `uid`, `name`, `fullName`, `age`, `birthDate`, `nationId`, `otherNationIds`, `clubId`, `club`, `ca`, `pa`, `positions`, `positionRatings` (15 values), `attributes` (62 named, display scale 1-20), `rawAttributes` (raw 1-100), and `source` (byte offsets of the person, ability and identity records, useful for locating neighbouring fields).

**Position semantics, now clear.** `positionRatings` is the 15 position-familiarity values (1-20) in this fixed order: GK, SW, DL, DC, DR, DM, ML, MC, MR, AML, AMC, AMR, ST, WBL, WBR. Examples:
- Barron: DM 15, MC 20, AMC 10 → listed positions DM, MC.
- McNamara: DC 17, DR 20, WBR 20 → DC, DR, WBR.
- Rushworth: GK 20, everything else 1.

The parser's `positions` list is just "rating ≥ 15". I checked all 222,391 players: lowest listed rating 15, highest unlisted 14, so this is SaveLens's own convention, not a game field. It means the design's natural/"cubre" distinction could be derived from the raw ratings (for example 20 = natural, 15-19 = covers), but the thresholds are our product decision.

**What the parser does not give, confirmed on this save:** wage, contract expiry, squad status, squad number, average rating or any season statistics, injuries, managed club, tactics, transfers. These need decoding from other members or from `game_db.dat` beyond what the parser reads.

**Observations useful for the next step:**
- The parser reads only `game_info.dat` and `game_db.dat`. `game_db.dat` is 492,262,890 bytes here.
- Each player carries byte offsets (`source.person`, `source.ability`, `source.identity`) into `game_db.dat`, so contract records can be searched relative to a known player rather than scanning blindly.
- Calling the 222k records "players" is generous: this database includes everyone with an ability block, including unemployed players and regens, not only registered squad players.
- The game's club identity: Aberdeen is club `id` 1122 in the parser's table. The club table itself comes from `game_db.dat` records, with the `nation` ordinal and short name.

## 12. Contract data located in `game_db.dat` (2026-11-03)

**Ground truth.** A screenshot of the in-game squad view (game date 6 Apr 2025, matching the parser's 2025-04-06) gives wage (in the user's currency, `$` per year) and contract end date for Aberdeen players. Transcribed in `tools/gt_aberdeen.json` (19 players; one wage unreadable).

**Findings** (**[verified]** on this sample, by exact search against those values):

1. **Date encoding.** A date is `u16 day-of-year` + `u16 year`, little-endian. The day lives in the low 9 bits, 1-based, using the real calendar of that year (31 May is 151 in 2027 and 152 in 2028, a leap year). The high 7 bits of the day word are flags or noise, so always mask with `& 511`. Same encoding as date of birth. Year `0x07e9` = 2025, `0x07ec` = 2028.
2. **Contract end date is stored in the bytes immediately before each player's person record** (`source.person`). For 18 of 19 players, searching the 600 bytes before it finds exactly one occurrence of the true end date. The distance varies (-111 to -471 bytes) because the preceding records vary in length. Before the end date there is a run of eight `ff` bytes. Right after the end date comes another date, which looks like the contract start (for example 31 May 2024 / 1 Jun 2024 for Muñoz and McNamara).
3. **Wage is a weekly amount in pounds, as a little-endian `u32`, also in the preceding bytes.** A single scale factor fits all 18 players with a readable wage: displayed `$` per year = stored × **64.9575**, which is 52 weeks × about 1.2492 USD per GBP (the game's own exchange rate at that date, and the user's display currency setting). Examples: Muñoz stored 8113 → $527,000/yr; McNamara 5603 → $364,000; Rushworth 3840 → $249,000; MacKenzie 2001 → $130,000. **Implication: the save stores wages in a base currency, and the displayed currency and the p/a-versus-p/w unit are display choices**, so the app must convert and let the user choose.
4. **Wage position relative to the end date** is `end + 26 + 29·k` bytes for most players (k = 1 for 9 players, k = 2 for 4, k = 3 for 3, k = 4 for 1). The 29-byte step matches the contract-event entry size in fm-toolkit's FM26 layout, so a contract has a variable number of 29-byte event entries between the end date and the wage. The number of events (`k`) is likely stored in the record.
5. **The FM26 chain-record tag `01 00 6c 07` also exists in FM24**: it appears 5,654,163 times in `game_db.dat` and always at the same spots just before person records. It is therefore a generic record marker, not a contract-specific one, and it cannot be used alone to find contracts.

**Update, same day: working extractor.** Two facts turned the failed prototype into a working one. Both come from the sample being a **second-season save**, with a chain of contracts per player.

6. **A contract is a chain record with a fixed shape around the tag `01 00 6c 07`**, matching FM26's layout closely: **wage = `u32` at tag+17** (GBP per week), **start date = date at tag-19**, **team reference = `u32` at tag+8**. The team reference is a per-team constant (Aberdeen's first team = `335360` for every current contract); a player's previous contracts carry their previous club's reference (Tyler Walker has one record with `335360` and an earlier one with `151040`). A club has one reference per team (first team, reserves, youth).
7. **The end date sits before the tag at `tag - 9 - 29k`, preceded by eight `0xFF` bytes**, where `k` is the number of 29-byte event entries in that record (k = 1 to 5 seen at Aberdeen).
8. **Pre-agreed future contracts exist in the chain.** Obafemi (renewal starting 1 Jun 2025) and Rubežić (starting 25 Jun 2025) each have a later record that is not yet in force. The current contract is the **latest record whose start is on or before the in-game date** (2025-04-06) and whose team reference belongs to the player's club.

Result of `tools/contract_probe.py` on the Aberdeen sample (19 players with a readable screenshot row): **end date correct 19/19, wage correct 18/18 where the screenshot shows it** (Rubežić's wage was hidden; the extractor gives £2,500 a week, which would display as $162,000 a year). A start date is also extracted for every player and looks plausible: 2024 renewals, and Rushworth's from 1 Feb 2025.

**Rounding note.** The game displays the $ wage rounded to the nearest thousand, so stored × 64.9575 is within about 0.4% of the display, not exact.

**How far this generalises (not verified).** The probe was run on all 222,391 players with no ground truth, as a sanity check only: **104,068 get a coherent current contract** (end after start and after the game date, wage between £1 and £493,335 a week, median £422), **592 look inconsistent** (end already past), and about **51,000 have a current contract with no end date found by the rule** (mostly low-paid contracts, such as youth players at £50-100 a week; their records have a different shape). Another 29,896 have no club and about 36,800 have no matching contract. So the rule is validated only for **first-team players like Aberdeen's**; other clubs and youth contracts need more ground truth (screenshots of other squads) before the extractor is trusted there.

**Still unknown:** the squad status, squad number and contract type bytes in the same record (the FM26 tail has them at fixed offsets; not measured in FM24), the field that holds the number of events `k` (currently found by scanning), and loans (a loaned-in player's record presumably points at the parent club).

Ground truth for further validation: `tools/gt_aberdeen.json`. Reproduce the experiments with `tools/savelens-dump.ts`, then the extracted `game_db.dat`, then `tools/contract_probe.py`.

## 13. Managed club, tactics and stats: first pass (2026-11-03)

Tooling: `tools/fm_members.py` lists and extracts any member (`list`, `extract OUTDIR names...`). Ground truth for stats: `tools/gt_stats.json` (19 Aberdeen players, from the squad-view screenshot).

**Managed manager, club and date: DONE (by name).** `save_game_summary.dat` (4,268 bytes) holds, as length-prefixed strings, the manager name (`Theo  Walcott`, first name, two spaces, surname) and the club (`Aberdeen`), followed by the in-game date as `u16 day-of-year` + `u16 year` (`60 58 e9 07` = day 96 of 2025 = 6 April 2025, matching the game). The same member lists the competition names, and a manager-appearance preset string (`Overcoat And Tie`). The name resolves to club id 1122 (club uid 1535, the only club named exactly `Aberdeen`; "Aberdeen University" is a different club). **Limitation:** this identifies the club by name, not by a numeric reference. If two clubs shared a name, the match would be ambiguous.
- `humans.dat` (29 KB) holds the human manager record: the same appearance string and a person id (`0x5fb92` = 392,082 at offset 11). Not yet tied to a name.

**`tactics_man.dat` (4.15 MB): partly mapped, not decoded.**
- It is a table of per-team records. Each record repeats a fixed block starting with the ASCII marker `I JBp` and contains lists of person references.
- The first region (offsets about 240 to 900) is a dense stream of references to **Aberdeen players only** (40 hits in 200 bytes, using the parser's entity `id`, as a little-endian `u32`), in a repeating roughly 28-byte pattern (`02 xx xx xx 00 02 ...  01 00 02 ...`). Its meaning is not established: it could be the managed team's selections, instructions, or relationships. **A screenshot of the in-game Tactics screen is needed** to interpret it (XI, roles, duties).
- Other records hold ascending runs of consecutive ids around `0x0670xx`, `0x0657xx` and `0x067cxx`, which look like squad lists of other teams made of created (regen) people.

**Season stats: not located.**
- Not in `game_db.dat` near the person records: a search for each player's minutes as a `u16` found no consistent relative offset across the 19 players.
- `pl_hist_dt.cmt` (72 MB) holds career-history rows of about 40 bytes (club references and years such as `dd 07` = 2013, `e7 07` = 2023), not the stat lines.
- `player_stats_hist_dt.cmt` (121 MB, header `03 01 'tmc.'`) is the likely home of stat lines, but a naive search (minutes plus companion values) is far too noisy to pin down a row layout. A per-season table for a known player is needed.

## 14. Career and season statistics: what was learned and what was not (2026-11-03)

Ground truth: `tools/gt_papela.json` (Papela's full career table and 2024/25 breakdown by competition, from a second screenshot; his player uid, 92089558, equals the parser's `uid`) and `tools/gt_stats.json` (19 players, current season).

**Learned (verified by inspection of the file):**
- `pl_hist_ls.dat` (8.2 MB, header `03 01 'tad.' 04 00` + 6 bytes) is a flat list of about 2.05 million `u32` byte offsets into `pl_hist_dt.cmt`. Each entry points **8 bytes before the row's year pair**: the career row's `u16 year_start, u16 year_end` is at `offset + 8` (97% of entries). Consecutive entries are grouped by player.
- `pl_hist_dt.cmt` rows are about 40 bytes: year start, year end, a flag byte, then two small count bytes at +5 and +6 (value 255 = not recorded; looks like appearances and goals for ordinary rows), then club-like references (`u32`, several of them) and date pairs. A typical row's reference at +11 is either a small club uid (like 1950) or a large value in the millions; they are **not** the same id space as the parser's club uid or club id for Mainz, Sandhausen or Aberdeen (searched for 916, 879280, 6000005, 1535, 613, 7633, 12367, 1122 in Papela's candidate rows without a hit).
- **Only completed seasons live here**: the year histogram of the whole list is 2022: 21,977 rows, 2023: 4,141, **2024: 6**, 2025: 0. The current season (2024/25) is stored elsewhere.
- A single record in `player_stats_hist_dt.cmt` (offset 102,414,038) contains Papela's 2,043 minutes with his starts (16) at +30, subs (22) at +8, assists (5) at +16, goals (4) at +38 and yellow cards (3) at +2, matching his "Global (Club)" line. It is a block of about 160 bytes of `u16` fields. **The same offsets do not reproduce the other 18 players**, so the layout is not generalised; with only one confirmed record I cannot tell which fields are per-competition and which are season totals.

**Not achieved:**
- Papela's career rows were not located in `pl_hist_dt.cmt`. Searches by year sequence (8 or 7 rows, any order), by apps/goals pairs and by club uid all failed. Likely causes: rows are stored with extra youth or reserve entries, or club references use a different id space.
- No working extractor for current-season stats.

**Decision:** statistics are **not needed by the mockup** (it only shows age, wage, contract, positions and a rating column), so they are deprioritised in favour of tactics, team separation and the squad plan. To resume this later, the cheapest next ground truth would be the same detailed stats table for two or three more players of different kinds, which would let the `player_stats_hist_dt.cmt` block layout be derived by comparison.

## 15. Tactic, selections and squad numbers (2026-11-03)

Ground truth: `tools/gt_tactics.json` (screenshot of the Tactics screen: tactic name and style, the 11 slots with role and duty, 9 substitutes, shirt numbers).

**Squad number: DONE.** One byte at **tag-12**, relative to the same contract tag used for wage and dates (section 12). Correct for **20 of 20** players of the selected squad. Across Aberdeen's 35 players with a current contract, all numbers are unique (2 to 42), and the value **255 means "no number"** (five youth players). `tools/contract_probe.py` now returns it.

**The managed team's selection: DONE (exact).** `tactics_man.dat` starts with a 29-byte header, then a table of 4-byte entries, each a player's **entity id** (the same `id` the parser reports):
- Header: `03 01 'tad.' 1a 00`, `01 00`, `0c`, then `u32` at offset 11 = **392,082** (the human manager's person id; the same value is in `humans.dat`), `u32` at 15 = 8, `u32` at 19 = **1310** (**Aberdeen's team id**: the team reference 335360 used in contract records equals 1310 × 256), and `09 03 00 00 00 00` (meaning unknown; possibly a tactic or formation id).
- Entries 0 to 10 (offsets 29 to 69) are the **starting XI in slot order**: GK, right back, right centre-back, left centre-back, left back, defensive midfielder, right central midfielder, left central midfielder, right attacking midfielder, left attacking midfielder, striker. This equals the order of the in-game list: Mair, McNamara, Gartenmann, Rubežić, MacKenzie, Clarkson, McGrath, Barron, Duncan, Muñoz, Ali.
- Entries 11 to 19 are the **substitutes S1 to S9**: Rushworth, Devlin, Corbo, Luan Patrick, Baningime, Papela, Thomas, Dhanda, Obafemi, matching the game's "S1..S9" labels in the squad view.
- Entries 20 to 25 are `ff ff ff ff` (empty): the list has 26 slots, 11 + 15 bench places.
- Players not selected (Vitols, Considine) do not appear in this list. This is the same list that appears as the "Posición" column (MPI, S6, S9, MC, DFD...) in the squad view, so the game's squad plan **is** this selection.

**Tactic name and style: located.** The text `4-3-3 MC Abierto Positiva - Tiquitaca vertical` (46 characters, length-prefixed with a `u32`) is at offset about 3200, followed by `Tiquitaca vertical` (the style name) at about 3272. The tactic name is stored as text in the save in the game's language.

**Role and duty per slot: candidate only. CORRECTED in section 16: this candidate record was probably not the roles; ignore the table below.** Around offsets 2996 to 3165 there is a library of 13-byte records `01 00` (or `02 00`) plus 11 role bytes, one per slot in the order above, for many formations. The record at offset 3034, `0f 0d 03 14 0d 19 29 49 10 08 60`, matches the tactic in the screenshot structurally: slots 1 and 4 (both "CAR Apoyo") are equal, and the other nine are all different:

| Slot | Role in screenshot | Byte |
|---|---|---|
| GK | PCI Apoyo | `0f` |
| right back | CAR Apoyo | `0d` |
| right centre-back | DCT Defensa | `03` |
| left centre-back | DFC Defensa | `14` |
| left back | CAR Apoyo | `0d` |
| defensive midfielder | PVO Defensa | `19` |
| right central midfielder | MEZ Apoyo | `29` |
| left central midfielder | CTT Apoyo | `49` |
| right attacking midfielder | II Apoyo | `10` |
| left attacking midfielder | DLI Ataque | `08` |
| striker | DLA Ataque | `60` |

Confidence is **low to medium**: the same shape matches 24 places in the first 4,000 bytes, several of them clearly other formations' presets, and one tactic cannot reveal the bit layout (for example, `29` and `49` share their low nibble and `19` also ends in `9`). A second tactic with different roles is needed to confirm which record is the user's and to decode role and duty. The in-possession, transition and out-of-possession instructions (the lists in the screenshot) are not decoded.

**The screen also shows** a three-slot tactic selector (tabs 1, 2, 3), a familiarity and an intensity bar, a "fluidity" setting (Flexible) and a role-quality rating in stars per slot (2 to 4.5 stars). The stars look computed by the game, not stored.

## 16. Three tactics: structure of `tactics_man.dat` (2026-11-03)

Ground truth: `tools/gt_tactics.json` now holds all **three tactic slots** (tab 1 `4-4-2 Positiva - Contrapresión`, tab 2 `4-3-3 MC Abierto Positiva - Tiquitaca vertical`, tab 3 `5-3-2 MC CR Positiva - Tiquitaca vertical`), with roles, duties and instructions, from three screenshots.

**Correction.** The 13-byte records near offset 3034 that I described in section 15 as a possible role table are **not** shown to be roles. The sequences predicted from tabs 1 and 3 (using the byte values from that candidate) were not found anywhere in the file. Treat that table as unexplained.

**Verified:**
1. **The squad selection is shared by all three tactics.** The block at offset 29 (11 starters + 9 substitutes, then six empty entries) is a property of the team, not of a tactic: the same 11 players and the same 9 substitutes appear in all three tabs; only the slot assignment, roles and formation differ. The 11 entries are in the game's **internal slot order**, which is not the visual order (Barron before McGrath, Duncan before Muñoz).
2. **Tactic data repeats five times.** Each tactic name appears 5 times, **8,063 bytes apart** (tab 1 at 1538, 9601, 19895, 27593, 38737; tab 2 at 3200, 11263, ...; tab 3 at 5361, 13424, ...). The first copy belongs to the managed first team (it follows the selection at offset 29 and uses team id 1310). The other four copies probably belong to the other teams of the club (reserves, under-18, and so on), but this is not checked.
3. **Name block.** Each tactic has a name stored as `u32 length` + UTF-8 text (`4-3-3 MC Abierto Positiva - Tiquitaca vertical`, 46 bytes), followed by the style name (`Tiquitaca vertical`).
4. **Per-slot blocks.** After the name there is one block per slot, each introduced by the marker `3a 00 02` and followed by a 22-byte payload; the blocks appear in the same order as the slots of the on-screen list for tabs 1 and 2. Payload layout (offsets within the payload):
   - **bytes 0-3**: a position mask (for example `01` = GK, `04` = right back, `08` = left back, `10 00 20 00` / `10 00 10 00` = right / left centre-back, `80` = defensive midfielder). They describe the **slot**, not the role: an "II Apoyo" at a wide midfield slot in tab 1 and a "MEZ Apoyo" at a central slot in tab 2 have identical first 12 bytes.
   - **byte 6: the duty**, verified on **22 of 22 slots** in tabs 1 and 2: `0x80` = Ataque, `0x40` = Apoyo, `0x20` = Defensa (an extra low bit, `0x41`, appears on the two "II / MEZ Apoyo" slots).
   - bytes 12-13: `01 01` constant; byte 14 and byte 18 vary per slot (values 02 to 09 and `01,02,04,08,10,20,40,80`) and look like slot or line indices, not roles.
5. **Goalkeeper.** `PCI Ataque` (tab 1) differs from `PCI Apoyo` (tabs 2 and 3) only in the duty byte (`80` against `40`), which confirms byte 6 and shows the role itself (`PCI`) is encoded elsewhere in the first 12 bytes (byte 5 = `10` for the goalkeeper).

**Not solved:**
- **Role identity.** The same displayed role gives different bytes in different slots, and different roles share bytes. The block does not carry a simple role id. Role is probably given by a combination of bytes 4, 5, 7 to 11, which also depend on the position. More data is needed to separate role from position.
- **Slot order in tab 3** (5-3-2): the duty sequence in list order does not match (expected 40,20,20,20,40,40,40,80,40,40,80; found 40,40,20,20,40,40,00,80,40,80,41), so the block order for that formation follows a different slot indexing than the on-screen list. Which slot index belongs to which pitch position per formation is not known.
- **Instruction lists** (with possession, in transition, out of possession) are not located. They differ between the tabs (for example tab 1 has "Ritmo algo más alto" and "Adelantar más"; tab 3 has "Enfocar el juego por el centro" and "Ser agresivos"), so comparing the three should reveal them, probably in the bytes between the name block and the first slot block.
- **Mentality and fluidity** (all "Positiva"; "Fluido" in tab 1, "Flexible" in tabs 2 and 3) not located. The fluidity difference should help find that byte.

## 17. Role names, player profile validation, contract tail (2026-11-03)

Ground truth: `tools/gt_gartenmann.json` (Stefan Gartenmann's profile screen: contract, status, attributes, height, weight, personality, season and career statistics) and a role-selection popup for Ryan Duncan at centre-back.

**Role names and duties, from the game (Spanish UI):**
- Duty abbreviations: **De** = Defensa, **Ap** = Apoyo, **At** = Ataque, **Ta** = Tapón, **Co** = Cubrir.
- The role popup for a centre-back lists: *Defensa central* (duties Defensa, Tapón, Cubrir), *Líbero*, *Defensa con toque*, *Central Práctico*, *Central lateral*. So **DFC = Defensa central** and **DCT = Defensa con toque**; Gartenmann's profile lists the same roles under "Rol y tarea" with their duty (`Defensa con toque (De)`, `Central lateral (De)`, `Defensa central (De)`, `Líbero (De)`, `Central Práctico (Ta)`) and a 0 to 5 star rating for each, so **the game computes a suitability per role for every player** (computed, not stored).
- Abbreviations still unconfirmed: `PCI`, `CAR`, `PVO`, `MEZ`, `CTT`, `II`, `DLI`, `DLA`, `2ºD`, `CRC`. Expansions seen in the UI would need the same popup per position.
- The popup also shows a position familiarity line (`Familiaridad con Defensa (Centro)`) and role-specific instructions (for the centre-back: `Regatear menos`, `Disparar menos a menudo`), which is another piece of the tactic data.

**Parser validation: 36 of 36 outfield attributes match the screenshot** for Gartenmann (technical, mental and physical, mapped from Spanish names to the parser's keys). The foot ratings agree: parser left 10 and right 20 correspond to "Razonable" and "Muy fuerte". CA 114 and PA 129 correspond to 3 stars and 3 stars. Date of birth (1997-02-02), age 28 and uid 27092473 match. This is a second independent confirmation that attributes, foot, CA/PA and date of birth are reliable.

**Not available from the parser (visible on screen):** height (185 cm) and weight (75 kg), personality label (Equilibrada), media handling, reputation stars, player traits, transfer value range ($2.2M to $3M), condition and injury risk, dynamics and morale. Not located in the save yet.

**Contract record tail (verified on 33 of 33 current Aberdeen contracts):**
- The tail follows the layout in FM26's reader: the end date, then the start date at `end+4`.
- **`end+14` = number of 29-byte events in the record; `k = count + 1`** for every contract. The extractor now uses this to reject false end-date matches: inconsistent contracts across all players dropped from 592 to 69 (coherent contracts 102,620; the stricter rule loses about 1,400 true matches).
- **`end+8` looks like a squad status code** (and `end+10` repeats it, or holds a second value). Gartenmann ("Jugador de plantilla") has **4**. Across Aberdeen's squad the values are 2 (Muñoz, Rushworth, Clarkson, Barron), 3 (Papela), 4 (about 14 players), 5 (Considine), 7 (Boyd-Munce, Thomas, Luan Patrick, Marcelo), 10 to 13 (youth: McDaid, McCoist, Steven, Vitols, Watson), 21 (Mair) and 0 (Obafemi, Samuel, Smillie). **Only 4 is labelled (one data point).** The extractor returns the raw code as `squad_status_raw`.
- The "3 Primas / 1 Cláusula" count (three bonuses, one clause) and the net wage ($197m, computed from tax) shown on the profile are not located. The clause table in FM26 lies in the record near the tag; not decoded for FM24.

**Season statistics on this screen are a second ground truth** (Gartenmann: 37 (4) appearances, xG 0.57, xA 1.10, average rating 6.89, passing 94%), but I did not search for them (see section 14).

## 18. Youth contracts and club inference (2026-11-03)

Ground truth: `tools/gt_aberdeen_u18.json` (19 players of Aberdeen's Sub-18 squad: age, wage, contract end; a screenshot). Extractor: `tools/fm_contracts.py` (supersedes `contract_probe.py`), evaluated with `tools/fm_contracts_eval.py`.

**Findings (verified):**
1. **The parser does not link youth-team players to their club.** All 19 Sub-18 players have `clubId = null` in the parser's output; they are part of the 29,896 players with no club. They are real, valid players with contracts.
2. **A contract points to the club, not to the team.** The Sub-18 players' contracts carry **the same reference (`335360`) as the first team's**. The player's club can therefore be **recovered from his current contract** by mapping each contract reference to the club that most of its linked players belong to. With that rule all 19 youth players resolve to Aberdeen (club id 1122), and **17,254 of the 29,896 club-less players get a club** from a coherent contract.
3. **Youth end-date pattern.** The 8 bytes before the end date are `ff ff ff ff 88 ff 00 00` (first team: eight `ff`). Only the first four bytes `ff ff ff ff` are common. The end date is at the same place (`tag - 38` for a record with no extra events), and the event count at `end+14` still holds (`0` events, `k = 1`).
4. **A player's records lie between the previous player's person record and his own.** Searching a fixed window picks up neighbouring players' records, which look the same (same club reference, similar start dates), so the window is now bounded by the previous person record. Club voting uses only each player's nearest valid record, because neighbours' records produced a wrong club (Motherwell) from vote noise.
5. **Display rounding.** The displayed wage is rounded to coarser steps for small amounts (the game rounds $46,834 to $47,000, $37,740 to $37,500, $29,880 to $30,000, $17,084 to $17,000, and $1,949 to $1,900). The worst gap between `stored × 64.9575` and the screen is **2.6%** (the £30 a week youth wage); every other player is within 1%. The stored value is exact; the screen rounds.
6. **Squad status codes of youth players:** 11 and 13 (23 players at 13, 17 at 11 in the Aberdeen group), distinct from first-team codes (4, 2, 3, 5, 7, 10, 21, 0). Meaning unknown; the screenshot's "Info" badges (`Juv`, `Seg`) don't line up with them (Mackie and Field both have `Seg` but codes 11 and 13).

**Results:**
- First team (19 players): **end date 19/19, wage 19/19.**
- Sub-18 (19 players): **end date 19/19, wage 19/19** (with the rounding tolerance above), club recovered **19/19**.
- Sanity run on all 222,391 players (no ground truth): **160,326 have a current contract**, of which **153,709 are coherent** (end after start and after the game date), **1,121 have an end already in the past**, and **5,496 have no end date found** (down from about 52,000 and 36,800 with the first extractor).
- 73 players are attributed to Aberdeen: the 36 linked by the parser, 32 club-less players (including the youth squads) and 5 players the parser links to another club (probably loans, unverified).

**Not verified:**
- Outside Aberdeen (one club only so far).
- The Reservas squad (not yet seen).
- Whether `335360` (a contract's club reference) equals `club_uid`-based or team-based identifiers in general (it equals team id 1310 × 256 for Aberdeen).
- Players who have a contract with one club and play for another (loans).

## 19. Reservas, a second club (Barcelona), affiliates and AI-team selections (2026-11-03)

Ground truth: `tools/gt_reservas_barca.json` (Aberdeen Reservas: 5 players with wage and contract end; FC Barcelona tactics screen: XI and substitutes with squad numbers, formation 4-2-3-1 MC MP Abierto).

**Results of `tools/fm_contracts.py` (the current extractor) on every squad seen:**

| Check | Result |
|---|---|
| Aberdeen first team: end date, wage | 19/19, 19/19 |
| Aberdeen Sub-18: end date, wage | 19/19, 19/19 |
| Aberdeen Reservas: end date, wage | 5/5, 5/5 |
| Barcelona: squad number of every player with a legible number | 16/16 |

**New findings:**
1. **The contract's anchor is a date field, not a fixed tag.** The 4 bytes where most records have `01 00 6c 07` are a date: `01 00 6c 07` is day 1 of year 1900, the game's null date. A record with a real first date (as for Levi Morgan, 24 June 2024) has the same layout otherwise. The reliable anchor is the **club reference at record+8** (the u32 `00 1e 05 00` for Aberdeen); the extractor now indexes the whole database by club reference with numpy (about 25 seconds for 222,391 players).
2. **Affiliated clubs.** A B team can be a *separate club* (Barcelona and "F.C. Barcelona Atlètic", ids 1247 and 1222). A player promoted to or shared with the first team can hold **two simultaneous contract records**: the parent club's, and a copy for the affiliate. The game shows the **parent** contract (its squad number: Prim 26, Guiu 9, Cubarsí 25) while the parser links the player to the B team. Two cases were met: (a) the same wage and end date at two clubs with different start dates: take the older one (the parent); (b) different terms (Adrian Gill: B team £848 a week to 2025, parent £12,199 a week to 2029): take the latest start. The extractor infers affiliated club pairs from the data: club B is affiliated to club A if at least 5 players (and at least 15% of A's players) linked to A also hold a record with B. It found 1,553 pairs, including Barcelona Atlètic to Barcelona, and none for Aberdeen (whose youth and reserve squads are teams inside the one club).
3. **Squad status codes.** Barcelona's players show: ter Stegen 1, Koundé 2, Christensen 3, Balde 3, Cancelo 3, Riad 4, Sadiki 4, Bardghji 4, Prim 10, Cubarsí 10, Fort 10, Guiu 11, Gill 11, Alarcón 13, Peña 20. Aberdeen's: Muñoz, Clarkson, Rushworth 2, Papela 3, Gartenmann and most first team 4, Considine 5, youth 10, 11 or 13, Mair 21. The codes look like an ordered scale of importance for outfield players (1 for the key player, 2 to 4 for first-team and squad players) with separate ranges for prospects (10 to 13) and goalkeepers (20, 21). Only **4 = "Jugador de plantilla"** is confirmed.
4. **AI teams use the same selection block.** Barcelona's team has the same list as Aberdeen's: **11 starters, then the substitutes, then empty `ff ff ff ff` entries, 26 entries in all**, at about offset 255,404 of `tactics_man.dat`. The starters follow the listed formation order (ter Stegen, Koundé, Christensen, Riad, Balde, Sadiki, Prim, Yamal, Fermín, "Pablo Páez" (Gavi), Vitor Roque), the 11 substitutes S1 to S11 follow (Peña, Cancelo, Bardghji, Guiu, Raphinha, Cubarsí, Darvich, Alarcón, Gill, Fort, Pradas), then Lucas Román. The 29-byte header with team id and manager id was only seen for the human team; the bytes before an AI team's block are different, so the team id is not yet read for AI teams.
5. **Name caveat.** The parser stores full registered names ("Lamine Yamal Nasraoui", "Pablo Páez" for Gavi, "Raphael Dias Belloli" for Raphinha, "Vitor Hugo Roque Ferreira"). The game screen shows nicknames. **Matching by displayed name fails for these players**; always use ids.
6. **Header ids.** The header of a club page shows an id (Aberdeen: 1536 on the first team page, Barcelona: 1708). The parser's club uid for Aberdeen is 1535 and for Barcelona 1707, so the displayed id is the parser's club uid + 1. Aberdeen Reservas and Sub-18 show ids 2000341187 and 2000341189, large values in the range of created entities, consistent with teams of their own.

**Overall sanity run (no ground truth):** 163,738 players get a current contract (of 222,391). Of these, 157,285 are coherent, 6,287 have no end date found and 166 have an end already in the past.

## 20. Teams, squad status labels, height and weight (2026-11-03)

Ground truth: `tools/gt_profiles.json` (profile screens of Reuben Smillie and Harvey Bardsley in Aberdeen's Reservas, and Charlie Cook in the Sub-18; the profile header names the team).

**Team link: DONE.** Each player's **ability block holds a team value, a `u32` at ability offset -23** (the parser already reads it as `team` but uses it only to find the club). It is the **ordinal of the team** whose record carries the team uid that the game shows as the page id:
- Smillie and Bardsley: team value **65414**, the team whose uid is **2000341187**, the id shown on the Aberdeen (Reservas) page.
- Cook: **65416**, uid **2000341189**, the Sub-18 page id.
- Gartenmann and the other first-team players: **1310**, whose uid is **1536** (the first-team page id; Aberdeen's club uid is 1535, so **a club's main team uid = club uid + 1**; the same holds for Barcelona: club uid 1707, team uid 1708, which resolves from ter Stegen's value 1446; and for the B team: club uid 1667, team uid 1668, which Prim and Cubarsí resolve to).
- **Complete separation on every squad seen:** Reservas 5 of 5 players with value 65414 (and exactly 5 players in the whole save have it, the same count as the screen); Sub-18 19 of 19 with 65416 (33 players have it in total, so the screenshot showed 19 of 33 rows); first team 19 of 19 with 1310 (31 players in total). So the 36 players the parser links to Aberdeen are the first team (31) plus the Reservas (5), and the Sub-18 are the parser's club-less players.
- The team table the parser builds is read **one row off** for these teams (the parser looks players up by `ordinal + 1`, which lands on the row of the neighbouring team) and it misses the first-team row of Aberdeen altogether. It only gets the club right by coincidence. Using the value as the team's own ordinal field, and the team's `uid` read at team-head offset +18, gives the ids shown in the game. Type bytes of the team heads: Aberdeen's Reservas team is type 100 with flag 20, the Sub-18 type 18 with flag 20; other types in the save: 19, 20, 21, 23 (meaning unknown).
- The contract's club reference is one id per club, which is why a contract cannot tell the squads apart; the **team value is how to tell them**.

**Squad status labels:**

| Code | Label in game | Evidence |
|---|---|---|
| 4 | Jugador de plantilla | Gartenmann |
| 11 | Futura promesa | Cook (full text), Smillie ("…ura promesa", partly hidden by a tooltip) |
| 13 | Joven | Bardsley (the label shown is "Joven"; might be shortened) |

All others (1, 2, 3, 5, 7, 10, 20, 21, 0) are still unlabelled. The label sits at the end of the contract box on the profile ("Contratado por el Aberdeen, $343m p/a hasta el 31/5/2027, Jugador de plantilla").

**Height and weight: DONE.** In the ability block: **weight at +82, height at +84** (`u16`, kilograms and centimetres), 4 of 4 exact (Gartenmann 185 and 75, Smillie 188 and 78, Bardsley 190 and 80, Cook 191 and 74). Across all 222,391 players the heights range 150 to 210 cm (median 180; goalkeepers 187, outfield players 179) and weights have a median of 71 kg; **about 1.3% of players have weight 0** (probably unset). Same order of fields as the live-memory layout in `fm-editor` (weight, then height, two bytes apart).

**Loans and agreed moves are extra records in the contract chain.** Smillie's chain holds, besides his Aberdeen contract (wage 381, status 11, number 40, to 2026-05-31): Queen of the South (wage 381, 2025-02-01 to 2025-05-31) and Peterhead (wage 220, same dates), both with status 0 and number 255; and two records that start on 2025-06-14: Queen's Park (to 2026-05-31) and Ross County (to 2027-05-31). The screen says "Se va al Queen's Park el 14/6/2025", so a future-dated record at another club corresponds to an agreed move (the Ross County record is probably an offer or another pending deal; unverified). The loan records carry the parent's wage and a very short span. The extractor ignores records that start after the game date, so these are not reported, and it keeps the Aberdeen contract because it is limited to the player's own (and affiliated) clubs.

**Also visible on these screens and not yet found in the save:** shirt number display (the contract number at tag-12 gives 40 for Smillie, correct), personality and media-handling labels, reputation stars, "valor de traspaso" range, "Joven cancerbero" (computed description), the "Rol y tarea" role stars (computed), the sanctions list (competition bans), and the "dinámicas" labels.

## 21. More profiles: status labels, height and weight, goalkeepers (2026-11-03)

Ground truth: `tools/gt_profiles.json` now holds 8 players (Gartenmann, Smillie, Bardsley, Cook, Muñoz, Papela, Mair, Considine) with height, weight, squad-status label, bonus and clause counts, net wage; Mair's goalkeeper attributes are included.

**Squad status: seven codes labelled** (the label is the last line of the contract box on the profile):

| Code | Label | Player |
|---|---|---|
| 2 | Jugador importante | Joaquín Muñoz |
| 3 | Titular habitual | Merveille Papela |
| 4 | Jugador de plantilla | Stefan Gartenmann |
| 5 | Revulsivo desde el banquillo | Andy Considine |
| 11 | Futura promesa | Charlie Cook, Reuben Smillie |
| 13 | Joven | Harvey Bardsley |
| 21 | Recambio de emergencia | Archie Mair |

The scale is ordered by importance, which is why the codes look the way they do: 1 is expected to be the key player (ter Stegen is 1), then 2 Jugador importante, 3 Titular habitual, 4 Jugador de plantilla, 5 Revulsivo desde el banquillo; 7 (Marcelo, Boyd-Munce, Thomas, Luan Patrick) is probably a rotation or backup status, 10 to 13 are the youth statuses (11 Futura promesa, 13 Joven), and 20 and 21 are goalkeeper backups (Peña 20, Mair 21). Codes 0 (no status set), 1, 7, 10 and 20 are still unlabelled; 0 is carried by players such as Obafemi, Samuel and Smillie's loan records.

**Height and weight: confirmed 8 of 8** (ability block, weight at +82 and height at +84, both `u16`).

**Goalkeepers: parser confirmed.** Mair's 35 attributes (13 goalkeeping, 14 mental, 8 physical; no technical outfield set) match the screen 35 of 35, and the foot ratings map consistently: left 20 = "Muy fuerte", right 7 = "Débil" (Gartenmann: left 10 = "Razonable", right 20 = "Muy fuerte").

**Not decoded:**
- **Bonuses and clauses** ("4 Primas / 1 Cláusula"). The counts do not sit at a fixed offset from the contract record, and their sum (4, 4, 5, 10, 4, 4, 6, 4 for the eight players) is not a byte at a fixed offset either. The bytes after the wage vary in length from player to player, so the clause table has a layout that depends on the contract (FM26 stores 8-byte entries after a count). Not needed by the mockup.
- **Net wage** ($293m a year net for Muñoz's $527m, $197m for $343m, $72m for $109m...). The ratio shrinks with wage (0.86 for Smillie, 0.78 for Cook, 0.71 for Considine, 0.66 for Mair, 0.57 for Gartenmann, 0.56 for Muñoz and Papela): it is the gross wage after the country's tax bands, **computed by the game, not stored**.
- **Career history rows and statistics** (see section 14).
- **Personality, media handling and reputation labels.** Personality labels such as "Bastante decidido", "Equilibrada" and "Profesional" come from the 8 personality attributes, which the parser reads; the label thresholds are the game's, not decoded.

## 22. Canteranos: the home-grown relations (2026-11-03)

Tool: `tools/fm_relations.py` (decodes the relation table of a player's record). No screenshot was needed: the check uses real-world knowledge of academy products, not in-game ground truth.

**Where it lives.** After the legal name in each person record there is a table of relations: `end = person_offset + 19 + u32@(person_offset+15)`, a flag byte `01` at `end+33`, a count at `end+34`, then 16-byte entries from `end+35`. Each entry has a referenced id (`u32` at 0), a **kind** (byte 10), a **role** (byte 11), a qualifier (byte 12) and a sentinel (`ff`, byte 15). FM26's documentation names several pairs; those that I could confirm in FM24:

| (kind, role) | Meaning | Reference holds |
|---|---|---|
| **(1, 72)** | **Home-grown club** (the club that trained the player) | **club id + 1** |
| **(8, 70)** | **Home-grown nation** (the country that trained him) | nation ordinal |
| (8, 9) | second nationality (SaveLens already uses this) | nation ordinal |
| (1, 3), (1, 4) | favoured and disliked club (FM26 doc) | club id + 1; not checked |
| (3, 1), (3, 2) | favoured and disliked person (FM26 doc) | entity id; not checked |
| (7, 18), (4, 25), (4, 67), (1, 106), (1, 105) | languages, regions, other (FM26 doc, unverified) | not checked |

**Verified.**
- **Aberdeen first team (31 players):** home-grown at Aberdeen: **Considine, Barron, MacKenzie, Duncan, Jordan Steven** (5), which are the club's real academy graduates. Everyone else points to their real youth club: Clarkson and Dhanda to Liverpool, Baningime to Everton, Obafemi to Southampton, Walker to Nottingham Forest, McNamara to Millwall, Papela to Mainz, Gartenmann to Heerenveen, Marcelo to Fluminense and Real Madrid, Shinnie to Inverness, Dom Thomas to Motherwell. Almost every Sub-18 player (30 of 33) and Kai Watson in the Reservas point to Aberdeen.
- **Barcelona selection (23 players):** the 13 flagged as home-grown at Barcelona are Balde, Prim, Yamal, Fermín, Gavi, Peña, Guiu, Cubarsí, Alarcón, Gill, Fort, Pradas and Riad: exactly the La Masia products; ter Stegen (Mönchengladbach), Koundé (Bordeaux), Christensen (Chelsea), Sadiki (Anderlecht), Cancelo (Benfica), Bardghji (København), Vitor Roque (Cruzeiro) and Darvich (Freiburg) are shown with their real youth clubs.
- **Consistency:** the home-grown nation equals the nation of the home-grown club for 101,890 players and differs for 4,672 (96% agreement); the differences are players with several entries (for example two home-grown nations).

**What the mockup's two KPIs could mean, from this data.**
- "Canteranos · plantel total": players whose home-grown club is the club itself. Aberdeen first team: **5 of 31**. (Barcelona selection: 13 of 23.)
- "Canteranos · liga local": players whose home-grown **nation** is the club's nation (**10 of 31** at Aberdeen: the 5 above plus Shinnie, Devlin, Dom Thomas, Mair and McCoist, who were trained in Scotland). This reading is my interpretation of the label; the user has not confirmed it.

**Not understood.** The qualifier byte on a (1, 72) entry takes the values 1, 2, 5, 8 and 10, and a player often has two entries for the same club (for example qualifiers 1 and 8 for Barron, 2 and 8 for most Sub-18 players). It might encode the age band or the years spent at the club; the meaning is not established. A player can have several home-grown clubs (Marcelo: Fluminense and Real Madrid; Corbo: Spezia and Bologna), and some have none (McGrath, Devlin, Mair, Muñoz, Rushworth, Samuel, Vitols, McDaid), so "no entry" is a normal state.

## 23. League-wide statistics screen and a second attempt at statistics (2026-11-03)

Ground truth: `tools/gt_premiership_stats.json` (the Cinch Premiership player-statistics page: top lists such as Mohanad Ali 20 goals, xG 15.98, 88.65 minutes per goal, Rubežić 70 shots, and 13 players with 32 appearances with their wins and losses). It is league-wide and aggregated, so it does not give one full row per player.

**Result: not located, and one earlier conclusion weakened.**
- Searching `player_stats_hist_dt.cmt` for Ali's season totals (starts 30, subs 12, goals 22, assists 4, minutes 2,461) finds 10 places where all four values occur near the minutes, but **no consistent field layout** among them (for example starts at +14, +30 or +45, goals at +8, +39, +74 or -82). The layout that fitted Papela's record (section 14: starts +30, subs +8, assists +16, goals +38) does not reproduce for Ali, so that single match may be partly coincidental.
- **Decimal statistics are not found** near Papela's record: no float32 and no ×100 integer near his expected goals (3.08), expected assists (4.92), tackles per 90 (2.29), dribbles per 90 (1.01) or average rating (7.00). The averages (rating, xG, xA, per-90 rates) are probably **computed from per-match records** rather than stored per player. The save does contain per-match data (about 330 `.apm` files named `<id>_<id>_<n>` and a 66 MB `match_stats_cfg.dat`), which would be the place to look next, but it is a different, larger reverse-engineering task.
- **Conclusion:** season statistics are not extractable with what I have. The mockup does not need them, so this stays closed unless the user wants a statistics feature.
