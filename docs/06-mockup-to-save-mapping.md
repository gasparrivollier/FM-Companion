# 06. Mockup to save mapping

Every feature of the prototype (`design/Artboard-7agu.dc.html`, described in [01](01-design-functionalities.md)) against what the save can provide. This supersedes `research/gap-analysis.md`.

Status: **Available** (read directly), **Derived** (computed from available data), **App** (lives in the app, not the save), **Partial**, **Decision** (a product choice is needed before it can be built), **Missing** (not obtainable).

## 1. Per-player data

| Mockup field | Source in the save | Status | Notes |
|---|---|---|---|
| Name | name pools, by `id` | **Available** | registered name; the screen uses nicknames for some players |
| Age and "+1 per planned season" | birth date and in-game date | **Derived** | matches the game on 8 profiles |
| Natural positions | the 15 position ratings (03, section 4) | **Derived** + **Decision** | the save has familiarity 1 to 20; "natural" needs a threshold (for example 20, or 15 and over) |
| "Cubre" positions | same ratings | **Derived** + **Decision** | same decision; the mockup also lets the user override it, which stays in the app |
| Wage per week | contract wage in pounds | **Available** | needs a display currency and rate; the game's own rate is about 1.249 dollars per pound |
| Contract expiry (year) | contract end date | **Available** | verified for Aberdeen's three squads |
| "Rtg" column | CA (verified), role-fit score (derivable from attributes), season average rating (missing) | **Decision** | the mockup's meaning is ambiguous; average rating is **not** available |
| Stable id | `uid` | **Available** | the game shows the same uid on the profile; stability across different saves of the same career is **not verified** |
| Squad number | contract record | **Available** | 255 means none |
| Squad status | contract record | **Partial** | 7 of about 12 codes labelled |
| Role (tactical, per slot) | chosen by the user | **App** | the game's role identity is not decoded; the duty is |
| XI slot, depth bands, custom tactics, saved views, columns | user choices | **App** | persisted by the app |

## 2. Squad and club

| Mockup need | Source | Status | Notes |
|---|---|---|---|
| Which club is mine | summary (name) and tactics header (team id) | **Available** | by name for the club; by id for the team |
| Which players are in "my squad" | team value in each ability block | **Available** | first team 31 players, Reservas 5, Sub-18 33 at Aberdeen. The user needs to choose which squads to include; the mockup shows one list |
| Team name | club name | **Available** | |
| Team colours | not in the save | **Missing** | keep the manual picker |
| Season label and "year the season ends" | in-game date | **Derived** | 2025-04-06 is season 2024/25, ending 2025; the design assumes the season rolls over in July |
| Import button (table export) | the save itself | **Replaced** | the product decision is to read the save; a save is 450 MB (see 07 and 08) |
| Pre-filled XI and bench | `tactics_man.dat` selection | **Available** | the game's current starting XI and substitutes, in internal slot order; a mapping from slot order to the mockup's slots per formation is **not built** |
| Formation presets | app | **App** | the game's tactic names are also readable (for example "4-3-3 MC Abierto Positiva") |

## 3. KPIs

| KPI | Definition decided | Source | Status |
|---|---|---|---|
| Canteranos · plantel total | players whose home-grown club is the club itself | relation (1,72) | **Available** (Aberdeen first team 5 of 31) |
| Canteranos · liga local | players trained in the club's own country | relation (8,70) and the club's nation | **Available** (10 of 31) |

Caveat: the minimum-time rule of the official "club-trained" status is not reproduced (the relation qualifier is not understood).

## 4. Charts and tables

All charts in the mockup (players per position group, wage total, average age) and the squad table columns (XI, name, natural, covers, age, wage, rating, contract, role) are **derived** from the fields above. Nothing else is needed from the save.

## 5. What the save offers that the mockup does not use

Candidate features for a later phase (not decided):

- All **54 attributes**, CA and PA, personality values, feet, height and weight: role-fit scores, "who could replace him" comparisons.
- Players of **every club** (222,391 players) with contracts: scouting and replacement search.
- Squad number, squad status, contract start.
- The **Reservas and Sub-18** squads as separate lists.
- Home-grown club and nation per player.
- The game's own **tactic names and selection**.
- Pending moves and loans (partly decoded, not exposed).

## 6. Product decisions still open (needed before building)

| # | Decision | Why it matters |
|---|---|---|
| 1 | What "Rtg" is: CA, a role-fit score, or something else (average rating is not available) | the column drives sorting and auto-fill |
| 2 | Thresholds for natural and "cubre" from the 15 position ratings | defines fit badges and candidate lists |
| 3 | Which squads count as "my squad" (first team only, or with Reservas and Sub-18) | defines the squad list and the KPIs |
| 4 | Display currency and exchange rate (the save stores pounds; the game uses the user's currency setting) | all wage figures |
| 5 | Whether the user may pick **any** club in the save or only the managed one | affects the first screen and the data volume |
| 6 | How plans survive a new save of the same career (join on uid; verify that uids are stable) | persistence |
| 7 | Language of the app (the mockup is Spanish; the save is language independent, role and status names are a mapping table, see 04) | UI |
| 8 | Whether to import the game's selection and tactic names as a starting point | optional feature |
