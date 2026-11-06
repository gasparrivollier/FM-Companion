# FM24 Companion: functionalities in the current design

Source: `design/Artboard-7agu.dc.html` (single 1440×1240 interactive artboard, Spanish UI). This is a prototype and the visual/behavioural reference. Nothing here is implementation. Written 2026-11-03.

> See also [06 mockup to save mapping](06-mockup-to-save-mapping.md) for which of these data needs the save can meet.

## 1. What the product is

A squad and tactics planner for Football Manager 24. The user imports their squad, lays out an XI on a pitch, plans depth (starter, backups, youth) per position, and plans up to 3 seasons ahead (contracts expiring, ageing). The design describes itself as "plan de plantilla".

## 2. Functional areas

### 2.1 Header and global
- Team name (editable in Settings) and the "FM24 Companion · Football Manager 24 · plan de plantilla" subtitle.
- **Importar archivo** button (accepts `.html .htm .csv .txt .tsv`). This is the prototype's input path, to be replaced by the save-file input (see section 4).
- Import status message (players imported, rows skipped).
- **Ajustes** modal: team name, "year the current season ends" (`baseYear`, defaults to the current year, +1 from July), two team colors (primary for the header, accent for buttons/selection) with swap and reset. Contrast-safe ink colors are derived automatically.
- Currency is a design prop (€, £ or $).

### 2.2 Season planning
- 3 season tabs (current, +1, +2) with labels such as `23/24`.
- Each season holds its own tactic and XI. Opening an empty season clones the current one.
- "Copiar plan de la temporada actual" copies season 0 into the selected season.
- Age is projected by +1 per season. Contracts expiring before the selected season are flagged.
- "Vaciar XI" with inline confirmation.

### 2.3 Tactic panel
- 8 preset formations: 4-4-2, 4-2-3-1, 4-3-3, 4-1-4-1, 4-1-2-1-2, 3-5-2, 3-4-3, 5-3-2.
- User-saved custom tactics ("Mis tácticas"): save as new, update, delete (with confirm). Name max 32 chars.
- "Cambios sin guardar" indicator.
- Switching formation remaps current players to the new slots (same position code first, then same group) and auto-fills gaps.
- Side-aware slot labels (e.g. DFCI/DFC/DFCD when 2+ slots share a base position).

### 2.4 Pitch
- SVG pitch with 11 draggable position tokens (pointer drag, arrow-key nudge of 2%).
- Token color by position group (POR, DEF, CEN, DEL). A badge marks a player who only "covers" (`~`) or is out of position (`!`). An alert dot marks a slot missing 2 natural players between starter and first backup.
- Click a token to select the slot, which swaps the right panel into slot-edit mode.
- Drag a player from a list row onto a token to assign.

### 2.5 Slot editing (right panel, when a slot is selected)
- **Role** chips per position (about 5 to 8 per position: Pivote, Mezzala, Falso 9, and so on). The Spanish role names are flagged in code as "to verify against the game".
- **Depth bands**: Titular (max 1), Suplentes (max 2), Recambios/juveniles (max 3), Otros (unlimited). Reorder (▲▼), remove, drag between bands. A full band shows a message.
- Candidate list: sorted by fit (natural, covers, out of position), with age, wage, rating, contract expiry and a pick button. Toggles: "show all positions" and "show U18".
- Clear position.

### 2.6 Squad analysis (right panel, when no slot is selected)
- Three bar charts by position group (POR/DEF/CEN/DEL): player count, wage total (per week), average age. Scope toggle: whole squad or starting XI.
- Squad table: search by name or position, group filter chips, sortable columns, **column picker**, and **views** (Básica, Táctica, Contratos, Finanzas plus user-saved views).
- Columns: XI slot, Jugador, Natural, Cubre, Edad, Sueldo/sem., Rtg, Contrato, Rol.
- Row click opens the player detail. Rows are draggable onto the pitch.

### 2.7 Player detail
- Name, position chips, age, wage per week, rating, contract-until year, assigned role.
- **Position model**: for each of the 14 positions the user cycles *not covered → natural → covers → not covered*. This is explicitly "the manager's criterion, beyond what the game says". The first natural position ("Principal") defines the group in charts and filters.
- Buttons: assign to the selected slot, remove from squad.

### 2.8 KPIs
- Two placeholder KPIs, "Por definir": **Canteranos · plantel total** and **Canteranos · liga local** (academy / home-grown players). The data need is known but undefined.

### 2.9 Persistence
- Everything is stored in the browser (`localStorage`, key `fm24companion.v3`) with migrations from v1 and v2. It stores squad, plans per season, custom tactics, views, columns, team name, colors and base year.
- A "Datos de ejemplo" tag shows while the fictional sample squad (24 players) is loaded.

## 3. Data model the design needs per player

| Field | Used for | Prototype source |
|---|---|---|
| name | list, tokens | import |
| natural position(s) | fit, groups, charts, filters | import (parsed from FM's Spanish/English codes) |
| "covers" positions | fit | user-defined (defaults to same group) |
| age | table, projection | import |
| wage per week | charts, table, candidate list | import (parsed with currency and unit handling) |
| rating | sorting, auto-fill, candidates | import (an "average rating" or "CA"-style column) |
| contract expiry year | expiry warnings per season | import |
| id | stable references in plans | generated |
| *(KPI, undefined)* home-grown or academy flag | canteranos KPIs | none yet |

Position codes in the design: POR, DFI, DFC, DFD, CRI, CRD, MC, MEI, MEC, MED, MPI, MPC, MPD, DLC (Spanish FM labels), with side variants. The import parser also accepts the English forms (GK, D(RLC), WB, DM, M, AM, ST).

## 4. What the save-file input must replace or provide

The prototype's only data entry is a table export (HTML/CSV) from the game's print screen, with a 300-row cap and positions that must be parsed from text. The product goal is to start from the **save file** instead. Mapping to the research (`docs/research/fm24-save-files.md`):

- Directly available from a parsed FM24 save: name, age/date of birth, nationality, club, positions (as familiarity ratings), CA/PA, all attributes, hidden attributes.
- **Not confirmed readable from an FM24 save by any known open tool**: wage, contract expiry, average rating, academy/home-grown flag. These are exactly the fields the design depends on. See the gap analysis in the research doc.

## 5. Open questions for later stages (not decisions)

- Which squad is "mine"? The save holds ~60-70k players; the app must find the managed club.
- Language: the UI is Spanish; FM's position and role labels depend on the game language, but a save holds language-independent IDs.
- Does the "covers" model derive from the game's position familiarity ratings instead of the manager's manual judgment?
- Definition of "canteranos" (club youth-academy origin versus home-grown rule versus league-local).
- "Rtg" ambiguity: season average rating, CA, or a role-fit score.
- The role list needs checking against FM24's real role set (the design says it is unverified).
