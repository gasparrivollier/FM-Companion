# 03. Data dictionary

What the app can read from an FM24 save, entity by entity. Offsets are in the decompressed `game_db.dat` unless another member is named. Confidence labels are defined in the [index](README.md). Sample sizes refer to the real screenshots in [05](05-validation.md).

## Contents
1. [Conventions](#1-conventions)
2. [Save and game](#2-save-and-game)
3. [Player identity](#3-player-identity)
4. [Player ability](#4-player-ability)
5. [Team and club](#5-team-and-club)
6. [Contract](#6-contract)
7. [Squad selection and tactics](#7-squad-selection-and-tactics)
8. [Home-grown ("canteranos")](#8-home-grown-canteranos)
9. [Seen on screen, not available](#9-seen-on-screen-not-available)
10. [Appendix: attribute table](#10-appendix-attribute-table)

---

## 1. Conventions

- **Little-endian** everywhere.
- **Record anchors.** `person_offset` is where a player's person record starts; `ability` is the offset of his ability block (the first of 54 attribute bytes); both are given by the parser as `source.person` and `source.ability`. `contract record` offsets are written `rec+N` (see section 6).
- **Dates:** `u16 day + u16 year`, day = low 9 bits, 1-based. Null date = 1900-01-01.
- **Money:** `u32`, pounds. Wages are **per week**. The game displays them in the user's currency and, on most screens, **per year**: `displayed = stored × 52 × rate`, rounded for display. The fitted factor in the sample is **64.9575** (stored weekly pounds to dollars per year, so a rate of about 1.2492 dollars per pound). In the Spanish UI an amount written `m` means **thousand** (`$343m p/a` is $343,000 a year).
- **Names:** the save holds the **registered name**; the game screen usually shows a nickname or short form. Always join on `uid` or `id`, never on a displayed name.
- **Absence is a state:** many optional fields are legitimately empty (no home-grown club, no squad number = 255, weight 0, no end date for some contracts).

---

## 2. Save and game

| Field | Where | Type | Confidence | Evidence |
|---|---|---|---|---|
| Format version | `game_info.dat` bytes 12 to 20, ASCII (`24.3.0+0`) | string | **Verified** | read on the sample; SaveLens 24 gates on this exact string and rejects FM23 (`23.4.0+0`) |
| Writing build | `save_game_summary.dat` (a `24.4.2` string after the competition names) | string | Inferred | looks like the build that last wrote the file |
| In-game date | `game_db.dat` u16 at 36 (`& 511` = day) and u16 at 38 (year) | date | **Verified** | 2025-04-06 equals the date on every screenshot |
| Manager name and managed club name | `save_game_summary.dat`: two length-prefixed strings (`Theo  Walcott`, `Aberdeen`) | strings | **Verified** | match the game; the date follows them (`60 58 e9 07`) |
| Managed team id | `tactics_man.dat` header, `u32` at offset 19 (= 1310) | `u32` | **Verified** | equals the team value of every Aberdeen first-team player |
| Manager person id | `tactics_man.dat` header `u32` at offset 11 (= 392,082), same value in `humans.dat` | `u32` | Verified (consistent in two members) | not tied to a name record |
| Number of players, clubs, teams | parser diagnostics | counts | Verified (parser) | 222,391 players, 50,801 clubs, 115,941 teams, 397,847 persons |

**Finding the managed club.** Resolve the club **name** in the summary to a club id (Aberdeen = id 1122, uid 1535). This is a name match; it would be ambiguous if two clubs shared an exact name (an "Aberdeen University" also exists, with a different name). The managed team id (1310) in the tactics header gives a second, id-based path.

---

## 3. Player identity

Source: the parser (`tools/savelens-dump.ts`), which implements FM SaveLens 24's reader.

| Field | Where | Type | Confidence | Evidence |
|---|---|---|---|---|
| Registered name (first, last, common name, full name) | name pools (three pools: first names, surnames, common names, with ids, `0xffffffff` = missing); a legal name is also stored inline in the person record | strings | **Verified** | all screenshots, with the nickname caveat below |
| `id` (entity id) | identity record, `u32` | `u32` | **Verified** | ascends with the person table order; referenced by `tactics_man.dat` selections |
| `uid` (public id) | identity record + 4 | `u32` | **Verified** | equals the id on a player's profile header (for example 27092473 for Gartenmann) |
| Source uid | identity record + 8 | `u32` | Verified | usually equals `uid`; differs in edited databases |
| Birth date | person record, `end` = `person_offset + 19 + u32@(person_offset+15)`; date at `end` | date | **Verified** | the 8 profiles (Gartenmann, Smillie, Bardsley, Cook, Papela, Mair, Considine, Muñoz) show matching dates of birth |
| Age | derived: game year minus birth year, minus 1 if the birthday has not happened yet | derived | **Verified** | all screenshots |
| Nationality | `u16` at `end + 9`, an internal **ordinal** (0 = Algeria) | `u16` | Verified (parser) | an id-to-name table is shipped in the parser (`nations.json`) |
| Second nationalities | relation table, (kind 8, role 9) entries (see section 8) | list | Verified (parser) | |
| 8 personality values | person record, 8 bytes at `end + 17` | 1 to 20 | Verified by SaveLens (FMRTE exports); not checked on screen here | |
| Relations | person record, table at `end + 33` | list | Partly verified | see section 8 |

**Nickname caveat.** The registered name differs from the on-screen name for some players: `Pablo Páez` for Gavi, `Raphael Dias Belloli` for Raphinha, `Lamine Yamal Nasraoui`, `Vitor Hugo Roque Ferreira`. Matching by displayed name fails for these. **Join on id.**

**Duplicates exist.** The same name can belong to several players (for example two "Scott Brown" players); name plus age was needed in the checks.

---

## 4. Player ability

All values below are in the **ability block**. Its offset `p` is `source.ability`. The parser finds it by structure (15 position bytes, then 54 attribute bytes, with CA and PA before them).

| Field | Where | Type | Confidence | Evidence |
|---|---|---|---|---|
| Current ability (CA) | `u16` at `p-38` | 1 to 200 | **Verified (parser, third party)** | SaveLens validated it against two FMRTE exports and screenshots; here only a consistency check: Gartenmann CA 114 and PA 129 show as 3 and 3 stars. The game shows stars, not the number |
| Potential ability (PA) | `u16` at `p-36` | 1 to 200 | **Verified (parser, third party)** | same |
| 15 position familiarity ratings | 15 bytes at `p-15 .. p-1`, values 1 to 20 | 1 to 20 | **Verified** | listed positions (rating of 15 or more) agree for the checked players |
| 54 attributes | 54 bytes at `p .. p+53`, raw **1 to 100** | | **Verified** | see below |
| Displayed attribute | `max(1, min(20, round(raw / 5)))` | 1 to 20 | **Verified** | **36 of 36** outfield attributes (Gartenmann) and **35 of 35** goalkeeper attributes (Mair) match the screen |
| Left and right foot | attributes `leftFoot`, `rightFoot` (1 to 20) | 1 to 20 | **Verified** | 20 = "Muy fuerte", 10 = "Razonable", 7 = "Débil" (5 profiles) |
| Hidden attributes | consistency, dirtiness, important matches, injury proneness, versatility (in the 54) and the 8 personality values | | Verified by SaveLens against FMRTE exports; **not checked on screen here** (the profile shows only labels) | `dirtiness`, `injuryProneness`, `controversy` are "inverted" (lower is better) |
| Weight | `u16` at `p+82`, kilograms | `u16` | **Verified** | **8 of 8** profiles; range 0 to 115, median 71; about 1.3% of players have **0** (unset) |
| Height | `u16` at `p+84`, centimetres | `u16` | **Verified** | **8 of 8**; range 150 to 210, median 180 (goalkeepers 187, outfield 179) |
| Team | `u32` at `p-23` | `u32` | **Verified** | see section 5 |

**The 15 position ratings, in fixed order:** `GK, SW, DL, DC, DR, DM, ML, MC, MR, AML, AMC, AMR, ST, WBL, WBR` (English codes as the parser names them; the Spanish UI equivalents are in [04](04-ui-glossary.md)). Examples: Barron has DM 15, MC 20, AMC 10; McNamara has DC 17, DR 20, WBR 20; Rushworth has GK 20 and 1 elsewhere.

**Natural and "covers".** The save gives familiarity ratings, not natural/covers flags. The parser's own list uses "rating of 15 or more" (checked over all 222,391 players: lowest listed rating 15, highest unlisted 14), which is **SaveLens' convention**, not a game field. The mockup's natural/covers split must be **derived with thresholds the product chooses** (for example 20 = natural, 15 to 19 = covers). Not decided.

**Caveat on ability.** Ability blocks are matched to people by entity-id ownership (the id just before the block must equal the person's id). Requiring public and source uid to be equal drops players added by edited databases. The parser handles this: 0 ambiguous and 0 unbound blocks in the sample.

---

## 5. Team and club

### 5.1 The two levels

A **club** (club table) owns one or more **teams** (team table). Aberdeen is one club with three teams: first team, Reservas, Sub-18. **Barcelona and "F.C. Barcelona Atlètic" are two separate clubs** (the B team is its own club), each with its own main team.

| Concept | Id in the parser | Notes |
|---|---|---|
| Club | `id` (0-based index) and `uid` | Aberdeen: id 1122, uid 1535. Barcelona: id 1247, uid 1707 |
| Team | the **ordinal** stored in each player's ability block, and a team **uid** | the team uid is what the game shows as the page id |

### 5.2 Which team a player belongs to: **verified**

The `u32` at `p-23` of the ability block is the **team ordinal**. The team record (a header found by the parser, `tools/savelens-teams.ts`) carries, at team-head offsets: ordinal at `+14` and **team uid at `+18`**. Looking a player's value up as the team's own ordinal field gives the id shown in the game:

| Squad | Team value | Team uid | Page id on screen | Players matched |
|---|---|---|---|---|
| Aberdeen first team | 1310 | 1536 | 1536 | 19 of 19 (31 players in total hold it) |
| Aberdeen Reservas | 65414 | 2000341187 | 2000341187 | 5 of 5 (exactly 5 in the save) |
| Aberdeen Sub-18 | 65416 | 2000341189 | 2000341189 | 19 of 19 (33 in total) |
| Barcelona first team | 1446 | 1708 | 1708 | ter Stegen resolves to it |
| Barcelona Atlètic | 1421 | 1668 | | Prim and Cubarsí resolve to it |

**Rules that follow:**
- A club's **main team uid = club uid + 1** (Aberdeen 1535 gives 1536; Barcelona 1707 gives 1708; Barcelona Atlètic 1667 gives 1668).
- Reserve and youth teams of a club have uids in the 2,000,000,000 range (created entities).
- The **SaveLens parser reads this table one row off** (it looks the value up as ordinal + 1) and misses Aberdeen's first-team row, so its `clubId` is right for first teams by coincidence, right for the Reservas, and **null for the Sub-18** (these are among the 29,896 club-less players). Do not rely on the parser's `clubId` alone.
- Team-head `type` bytes seen: 100 (the Reservas team; Aberdeen's own first-team row is **not** read by the parser), 18 (the Sub-18 team), 19, 20, 21, 23. Their meaning is **unknown** beyond those two observations.

### 5.3 Club table

Name, short name, club id, uid, nation (ordinal): from the parser. 50,801 clubs. A club's nation is needed for the "liga local" KPI.

---

## 6. Contract

The most reverse-engineered part of the save. Implemented by `tools/fm_contracts.py`. Scored against ground truth: see [05](05-validation.md).

### 6.1 The record

A player's contract history is a chain of **records placed in the bytes before his person record**. A record is anchored by a **club reference** (`u32` at `rec+8`). Offsets below are from `rec`, the first byte of the record.

| Offset | Field | Type | Notes |
|---|---|---|---|
| `rec+0` | a date field | 4 bytes | `01 00 6c 07` (null date, 1900-01-01) in most records; a real date in some (a record that holds a real date there was the cause of one early miss). **It is not a reliable anchor.** |
| `rec+4` | selector | `u32` | not decoded |
| `rec+8` | **club reference** | `u32` | one value per club (Aberdeen = 335,360 = team ordinal 1310 × 256). The same value for first team, Reservas and Sub-18, so it **cannot** tell the squads apart; use the team value (section 5) for that |
| `rec+17` | **weekly wage** | `u32`, pounds | **Verified** |
| `rec-19` | **start date** | date | **Verified** (see 6.3) |
| `rec-12` | **squad number** | `u8`, **255 = none** | **Verified** |
| `end` = `rec-9-29k` | **end date** | date | see 6.2 |
| `end+4` | a second date | date | looks like the start (same as `rec-19`) |
| `end+8` | **squad status code** | `u8` | see 6.4 |
| `end+14` | **event count** | `u8` | `k = count + 1` (33 of 33) |

### 6.2 Finding the end date

Between the end date and the record there are **`k` event entries of 29 bytes**, so `end = rec - 9 - 29k`. The event count is stored at `end+14`, which gives `k = count + 1`. The bytes just before the end date are `ff ff ff ff ff ff ff ff` for first-team players and **`ff ff ff ff 88 ff 00 00`** for youth contracts; only the first four are common, so the extractor accepts `ff ff ff ff` and then requires the event count to agree. A false match must fail both tests.

### 6.3 Choosing the current contract

The chain also holds older contracts, **pre-agreed future contracts**, **loan records** and **affiliate registrations**. The rules, in order:

1. **Bound the window.** A player's records lie between the previous player's person record (plus about 250 bytes) and his own. Never search a fixed window: neighbouring players' records look the same.
2. Keep records whose **start is on or before the in-game date**.
3. Keep records at **his own club or an affiliated club**. Two clubs are *affiliated* if at least 5 players, and at least 15% of the players linked to club A, also hold a record at club B (1,553 such pairs found, including Barcelona Atlètic to Barcelona; none for Aberdeen).
4. Take the **latest start**.
5. **Affiliate duplicate rule.** If another record at a different club has the **same wage and the same end date but an earlier start**, take that one: it is the parent club's contract, and it is the one the game shows (with its squad number: Prim 26, Guiu 9, Cubarsí 25, while the B-team copy has 255, 24 and 255).
6. The extractor also infers a **club for club-less players** from the contract's club reference (a map reference to club, from the players the parser did link), which recovers the club for 18,350 of the 29,896 club-less players.

### 6.4 Squad status

| Code | Label in the game (Spanish) | Evidence |
|---|---|---|
| 2 | Jugador importante | Muñoz |
| 3 | Titular habitual | Papela |
| 4 | Jugador de plantilla | Gartenmann |
| 5 | Revulsivo desde el banquillo | Considine |
| 11 | Futura promesa | Cook, Smillie |
| 13 | Joven | Bardsley |
| 21 | Recambio de emergencia | Mair |

The codes look ordered by importance. **0, 1, 7, 10, 20 are unlabelled** (1 is carried by ter Stegen; 7 by Marcelo, Boyd-Munce, Thomas, Luan Patrick; 10 by Barcelona B-team players; 20 by Barcelona's second goalkeeper Peña; 0 by players with no status and by loan records).

### 6.5 Other records in the chain

- **Loans** appear as extra records at the borrowing club with the **parent's wage**, a short span, status 0 and number 255 (Smillie: Queen of the South and Peterhead).
- **Future moves** are records with a start after the game date at another club (Smillie: Queen's Park and Ross County, both from 2025-06-14; the screen says "Se va al Queen's Park el 14/6/2025"). The extractor ignores records that start after the game date, so **pending moves are not reported yet**.

### 6.6 Scores and coverage (details in 05)

- Aberdeen first team: end date 19/19, wage 19/19. Sub-18: 19/19, 19/19. Reservas: 5/5, 5/5. Barcelona squad numbers: 16/16.
- Over all 222,391 players (no ground truth): **163,738 have a current contract**, 157,476 are coherent (end after the start and after the game date), **6,029 have no end date found**, 233 have an end already in the past.
- The wage is exact in the save; the screen **rounds** it (stored 30 pounds a week shows as $1,900 a year, a 2.6% gap; every other checked player is within 1%).

### 6.7 Not available

- **Bonuses and clauses** (the "3 Primas / 1 Cláusula" line). Not at a fixed offset; the clause data changes length from player to player.
- **Net wage.** Computed by the game from tax bands (kept share from 0.56 to 0.86); not stored.
- **Transfer value range** ("$2.2M - $3M"): not located.

---

## 7. Squad selection and tactics

Source: `tactics_man.dat` (4.15 MB). Implemented only as ad-hoc scripts; no extractor yet.

### 7.1 The squad selection: **verified**

The managed team's selection starts at offset 29:

```
offset 0   03 01 'tad.'  1a 00       magic and a version
offset 8   01 00                     (count, meaning not confirmed)
offset 10  0c                        (constant)
offset 11  u32  392082               the human manager's person id
offset 15  u32  8                    (meaning unknown)
offset 19  u32  1310                 the managed TEAM id (Aberdeen)
offset 23  09 03 00 00 00 00         (meaning unknown, possibly a tactic id)
offset 29  26 x u32                  the selection: 11 starters, then substitutes, then ff ff ff ff for empty places
```

- Entries are player **entity ids** (the parser's `id`).
- **Entries 0 to 10 are the starting XI in the game's internal slot order**, which is the formation's order and not always the visual order (Aberdeen 4-3-3: GK, right back, right centre-back, left centre-back, left back, defensive midfielder, **Barron, McGrath** (the on-screen list shows McGrath first), Duncan, Muñoz, Ali).
- Entries 11 onward are the substitutes S1, S2, ... in order (Aberdeen: S1 Rushworth to S9 Obafemi, then six empty entries; Barcelona: 11 substitutes then Lucas Román).
- **The selection is shared by the three tactic slots** of a team: the same 11 players and 9 substitutes appear in all three Aberdeen tactics; only the slot assignment, roles and formation change.
- **AI teams have the same structure** (Barcelona's block is at about offset 255,404). The header with team id and manager id is only seen for the human team; the bytes before an AI team's block differ, so the team id is not read for them.
- Players not listed (Vitols, Considine) are simply absent. This list is the same as the "Posición" column of the game's squad view (MPI, MC, DFD, S1 to S9).

### 7.2 Tactic names and style: **verified**

Each tactic's name (`4-3-3 MC Abierto Positiva - Tiquitaca vertical`) is stored as a `u32` length plus UTF-8 text, followed by the style name. The three Aberdeen tactics appear **five times each, 8,063 bytes apart**: the first copy is the managed first team; the other four probably belong to the club's other teams (not checked). In the first copy the names are at offsets 1538, 3200 and 5361.

### 7.3 Per-slot blocks: **partly decoded**

After a tactic name there is one block per slot, starting with the marker `3a 00 02` followed by a 22-byte payload.

| Payload bytes | Meaning | Status |
|---|---|---|
| 0 to 3 | position mask (for example `01` goalkeeper, `04` right back, `08` left back, `10 00 20 00` and `10 00 10 00` right and left centre-back, `80` defensive midfielder) | Describes the **slot**, not the role |
| **6** | **duty**: `0x80` Ataque, `0x40` Apoyo, `0x20` Defensa (an extra low bit `0x41` appears on two slots) | **Verified** on 22 of 22 slots in tactics 1 and 2; tactic 3 uses a different slot order |
| 12 and 13 | `01 01` constant | |
| 14, 18 | vary per slot | look like slot or line indices |
| the rest | | **Role identity is not decoded** |

### 7.4 Not decoded

- **Role identity** (PCI, CAR, DCT, ...): the same displayed role gives different bytes in different slots.
- **The slot order of other formations** (tactic 3, the 5-3-2, does not follow the on-screen list).
- **Instructions** (with possession, in transition, out of possession), **mentality**, **fluidity**.
- An earlier "role record" candidate (`0f 0d 03 14 0d 19 29 49 10 08 60` near offset 3034) was **disproved**; do not use it.

---

## 8. Home-grown ("canteranos")

A player's person record holds a **relation table**. Implemented by `tools/fm_relations.py`.

```
end   = person_offset + 19 + u32@(person_offset + 15)
flag  = u8@(end+33)    must be 1
count = u8@(end+34)
entry i at end + 35 + 16*i :   u32 referenced id @0 ; kind u8 @10 ; role u8 @11 ; qualifier u8 @12 ; sentinel 0xff @15
```

| (kind, role) | Meaning | The id holds | Confidence |
|---|---|---|---|
| **(1, 72)** | **home-grown club**, the club that trained the player | **club id + 1** | **Verified** (see below) |
| **(8, 70)** | **home-grown nation** | nation ordinal | **Verified** (96% agreement with the nation of the home-grown club) |
| (8, 9) | second nationality | nation ordinal | Verified (parser) |
| (1, 3), (1, 4), (3, 1), (3, 2), (7, 18), (4, 25), (4, 67), (1, 106), (1, 105) | favoured and disliked club and person, languages, regions, others | various | **Unknown**, taken from FM26 documentation only |

**Verification.** The relation was compared with real-world facts, not with a screenshot:
- Aberdeen first team: the five players home-grown at Aberdeen are Considine, Barron, MacKenzie, Duncan and Jordan Steven; everyone else shows his real youth club (Clarkson and Dhanda: Liverpool; Baningime: Everton; Obafemi: Southampton; Papela: Mainz; McNamara: Millwall; Marcelo: Fluminense and Real Madrid). 30 of 33 Sub-18 players point to Aberdeen.
- Barcelona selection: the 13 flagged as home-grown at Barcelona are exactly the La Masia products (Balde, Prim, Yamal, Fermín, Gavi, Peña, Guiu, Cubarsí, Alarcón, Gill, Fort, Pradas, Riad); ter Stegen, Koundé, Christensen, Sadiki and Cancelo show their real youth clubs.

**The two KPIs, as decided:**
- *Canteranos · plantel total* = players whose home-grown club is the club itself. Aberdeen first team: **5 of 31**.
- *Canteranos · liga local* = players whose home-grown **nation** equals the club's nation (the club table gives a nation ordinal; Scotland is 167). Aberdeen first team: **10 of 31** (the 5 above plus Shinnie, Devlin, Dom Thomas, Mair, McCoist).

**Caveats.** A player can have several home-grown clubs (Marcelo, Corbo) or none (McGrath, Devlin, Mair, Muñoz, Rushworth, Samuel, Vitols, McDaid). The qualifier byte (values 1, 2, 5, 8, 10; often two entries for the same club, for example 1 and 8) is **not understood**, so the official "club-trained" rule (a minimum time at the club) is **not reproduced**; the data says "trained at" and nothing about how long.

---

## 9. Seen on screen, not available

| On screen | Status |
|---|---|
| Season and career statistics (appearances, goals, assists, minutes, average rating, xG, xA, per-90 values) | **Not obtained.** One stats record was found for one player, but its layout did not generalise; decimals are probably computed from per-match data. See 08 |
| Role and duty names per tactic slot, role suitability stars | Duty decoded; role identity not; the stars are computed by the game |
| Tactical instructions, mentality, fluidity | Not decoded |
| Contract bonuses, clauses, net wage, transfer value | Not available (see 6.7) |
| Condition, injury risk, form, morale, dynamics, sanctions, press and media labels | Not located |
| Personality **labels** ("Bastante decidido") and the player-type description ("Joven cancerbero") | Derived by the game from attributes; the 8 personality values are available, the label thresholds are not |
| Reputation stars | Not located |
| Shirt number display, positions diagram | Number is available (6.1); the diagram is derived from the 15 position ratings |

---

## 10. Appendix: attribute table

The 54 attribute bytes at `ability + index`, in this order. Group names are the parser's. The display value is `round(raw / 5)` clamped to 1 to 20; the 8 personality values (`adaptability, ambition, loyalty, pressure, professionalism, sportsmanship, temperament, controversy`) are stored on the 1 to 20 scale in the person record, not in this block.

| Index | Key | Group | | Index | Key | Group |
|---|---|---|---|---|---|---|
| 0 | crossing | technical | | 27 | corners | technical |
| 1 | dribbling | technical | | 28 | teamwork | mental |
| 2 | finishing | technical | | 29 | workRate | mental |
| 3 | heading | technical | | 30 | longThrows | technical |
| 4 | longShots | technical | | 31 | eccentricity | goalkeeping |
| 5 | marking | technical | | 32 | rushingOut | goalkeeping |
| 6 | offTheBall | mental | | 33 | punching | goalkeeping |
| 7 | passing | technical | | 34 | acceleration | physical |
| 8 | penaltyTaking | technical | | 35 | freeKickTaking | technical |
| 9 | tackling | technical | | 36 | strength | physical |
| 10 | vision | mental | | 37 | stamina | physical |
| 11 | handling | goalkeeping | | 38 | pace | physical |
| 12 | aerialReach | goalkeeping | | 39 | jumpingReach | physical |
| 13 | commandOfArea | goalkeeping | | 40 | leadership | mental |
| 14 | communication | goalkeeping | | 41 | dirtiness | hidden |
| 15 | kicking | goalkeeping | | 42 | balance | physical |
| 16 | throwing | goalkeeping | | 43 | bravery | mental |
| 17 | anticipation | mental | | 44 | consistency | hidden |
| 18 | decisions | mental | | 45 | aggression | mental |
| 19 | oneOnOnes | goalkeeping | | 46 | agility | physical |
| 20 | positioning | mental | | 47 | importantMatches | hidden |
| 21 | reflexes | goalkeeping | | 48 | injuryProneness | hidden |
| 22 | firstTouch | technical | | 49 | versatility | hidden |
| 23 | technique | technical | | 50 | naturalFitness | physical |
| 24 | leftFoot | feet | | 51 | determination | mental |
| 25 | rightFoot | feet | | 52 | composure | mental |
| 26 | flair | mental | | 53 | concentration | mental |
