# 02. The save container

All facts were checked on the sample save `Theo Walcott - Aberdeen - Canadá.fm` (454,368,930 bytes, internal version `24.3.0+0`, last written by game build `24.4.2`). Where a fact comes from another project's documentation and was not re-checked, it says so.

## File layout

A `.fm` file is an **archive of named members**. Each member is compressed independently.

```
offset 0   02 01 66 6d 66 2e            signature ("\x02\x01fmf.")
offset 6   08 00 00                      constant in the sample
offset 9   u64 little-endian             pointer to the trailer (here 454,327,053)
offset 17  8 bytes                       (not decoded)
offset 25  u8 compression flag           3 = Zstandard (the sample), 0 = plain (reported by SaveLens 24)
offset 26  member frames, back to back   (one Zstandard frame per member in the sample)
...
9 + ptr    02 01 66 6d 66 2e 08 00 00    9-byte trailer header
9 + ptr + 9  Zstandard frame             the manifest, runs to the end of the file
```

- Member offsets are relative to **byte 26**.
- Frame boundaries must come from the manifest. Searching for the Zstandard magic (`28 b5 2f fd`) gives false positives inside compressed data, and reading the whole remaining file for every frame is quadratic and too slow.
- **Plain saves exist.** SaveLens 24 validated 53 plain and 8 Zstandard FM24 saves, so a reader must support both. Our sample is Zstandard only, so the plain path was **not** exercised here.

## The manifest

The manifest decompresses to 157,620 bytes in the sample and parses with no leftover bytes.

```
u32 length + bytes     save name
u32                    number of top-level members
per member:
   name parts: u32 length + bytes, repeated until a part starts with '.'  (name, then the extension)
   u64 offset (relative to byte 26)
   u64 stored size          (compressed)
   u64 plain size           (decompressed)
   16 bytes                 two 8-byte stamps (not decoded)
u32                    number of sub-archives
per sub-archive:  name, u32 child count, then the children in the same member format
00 00 00 00            terminator
```

In the sample: **750 top-level members** plus one sub-archive, `rgman`, with **1,640** members (competition rule files), so 2,390 members in all.

Every decompressed member begins with a 6-byte magic: `03 01 'tad.'` for `.dat` members and `03 01 'tmc.'` for `.cmt` members (history tables).

## Members that matter

Sizes are stored then plain, from the sample.

| Member | Size | Role | Status |
|---|---|---|---|
| `game_db.dat` | 162.9 MB then **492.3 MB** | The main database: persons, players, staff, clubs, teams, contracts, competitions | **Used.** Everything in 03 except tactics and the save summary comes from here |
| `game_info.dat` | 2.9 KB plain | Internal version string `24.3.0+0` at bytes 12 to 20, then the list of applied patches | Used (version gate) |
| `save_game_summary.dat` | 4.3 KB plain | Manager name, managed club name, in-game date, competition names | **Used** (managed club) |
| `tactics_man.dat` | 4.2 MB plain | Tactic tables per team, squad selections | **Partly used** (selection, tactic names, duty) |
| `humans.dat` | 29 KB plain | The human manager record (appearance string and person id 392,082) | Read, little used |
| `manager_manager.dat` | 4.7 MB plain | Manager data | Not decoded |
| `contract_man.dat` | 36 KB plain | Contract **offers and negotiation events**, not the contract table | Not used |
| `shortlist_man.dat`, `scout_man.dat`, `transfer_man.dat`, `injury_manager.dat`, `finance_manager.dat`, `training_man.dat`, `morale_manager.dat`, `captain_system.dat`, `team_talk_man.dat` | various | Subsystems | Extracted, **not decoded** |
| `pl_hist_dt.cmt`, `pl_hist_ls.dat`, `player_stats_hist_dt.cmt` | 72 MB, 8 MB, 122 MB plain | Career history and statistics | Structure partly understood, **not decoded** (see 08) |
| `*.apm` (about 330) and `*.scm` (about 340) | small | Per-match data (names like `<id>_<id>_<n>`) | Not examined |

## Facts about the data inside `game_db.dat`

- It is a binary dump with **no fixed record table**. Records are found by structure (pointer-free patterns), which is why the existing readers use pattern scanning and ownership checks.
- **Dates** are `u16 day-of-year` + `u16 year`, little-endian. Only the **low 9 bits** of the day are the day (`& 511`, 1-based, real calendar of that year; 31 May is 151 in 2027 and 152 in 2028). The high 7 bits are flags and must be ignored. Year `0x07e9` is 2025.
- The in-game date is at `game_db.dat` offsets 36 (day) and 38 (year); `save_game_summary.dat` holds it too.
- **Null date** is 1 January 1900: bytes `01 00 6c 07`.
- **Money** is stored as unsigned 32-bit integers in a base currency (pounds), per week for wages. The currency and the per-year display are display choices (see 03).
- Ids come in several spaces and must not be mixed: the parser's **entity id** (`id`, small, ascending by record order), the **uid** (public id, large for created players), the **club id** (index into the parser's club table, 0-based) and the **club uid**. The game screens show uids (a player's profile header shows his uid).

## Facts about other projects' work

These were read from documentation and not re-verified unless stated in 05:

- FM SaveLens 24 documents the plain/Zstandard flag and the header adjustment in `archive.ts`.
- Gilet and fm-toolkit document the FM26 equivalent (always Zstandard, 81 core sections); the FM24 save has a very different member list (for example `.cmt` members are histories in FM24 and localized commentary in FM26), so **FM26 documents cannot be applied to FM24 offsets**.
