# FM24 Companion: planner UI (plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole prototype (`design/Artboard-7agu.dc.html`) as a working planner that reads a snapshot and the owner's own data, runs in a browser with `npm run dev`, and keeps the owner's data across re-imports. Automatic XI generation is out.

**Architecture:** Pure TypeScript domain modules in `src/planner/domain/` (all behaviour, tested in Node, ported function by function from the prototype's script, lines 523-797 and 800-1395), a reducer in `src/planner/state/`, and thin React components in `src/planner/ui/`. Three seams keep plan 3 small: `SnapshotSource` (where the snapshot comes from), `OwnerStorage` (where the owner's data lives) and the currency formatter. Plan 2 supplies a dev snapshot source (Vite middleware serving `out/snapshot.json`) and a `localStorage` storage. Plan 3 swaps in Electron implementations.

**Tech Stack:** React 19, Vite, TypeScript (`erasableSyntaxOnly`), Vitest (Node for the domain, jsdom for components), Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-fm24-companion-design.md`. Contract: `src/shared/snapshot.ts`. Reference behaviour: the prototype script. Position and status labels: `docs/04-ui-glossary.md`.

## Global Constraints

- The UI is **Spanish**; copy is taken from the prototype where it exists. No network calls anywhere (no web fonts from a CDN: bundle Barlow and Barlow Condensed locally with `@fontsource` or fall back to `system-ui`).
- The planner reads **only** the snapshot and the owner's data. It never reads the save.
- Players are matched by **`uid`**, never by name. Every owner-made record is keyed by `uid`.
- **Re-import never touches owner data** (plans, tactics, views, position marks, settings). An import only refreshes the snapshot.
- Wages are stored in **pounds per week**; display converts. Defaults: `$` = 1.2492 per £; `€` default **1.17 per £** (my call, editable). Default currency `$`.
- "Rtg" shows **CA** (1 to 200), no decimals. Squad status shows only the seven labelled codes (2, 3, 4, 5, 11, 13, 21); others show nothing. No contract end shows "–".
- Position model: imported natural = familiarity **20**, covers = **15 or more**; the owner's manual marks always win. The XI **starts empty**; no auto-fill on formation change (the prototype's `fillGaps` and `autoPick` are not ported).
- Plans are keyed by **absolute season** (the year the season ends, e.g. 2026 for 2025/26), never by "current, +1, +2".
- Owner data file is **versioned** (`OWNER_VERSION = 1`) with migrations; a file with a newer version is **refused and never overwritten**.
- Windows is the target: no path or shell assumptions in the UI code. TypeScript sources use no enums, namespaces or parameter properties.

## Review Focus

Each line is pinned by a test in the task named.

1. A planned player is **absent from the new snapshot**: stays in the plan, flagged "ya no está en la plantilla", nothing deleted, no crash (Task 8).
2. A manual position mark for a `uid` **survives** a re-import whose proposal for that player changed (Task 8).
3. Owner data file **newer than the app**, or **unparseable JSON**: not loaded, not overwritten, a visible error (Task 3, Task 10).
4. A snapshot taken **in a later season** shifts the three tabs forward; the old season's plan is still stored and no plan is lost (Task 4, Task 8).
5. Players with **no contract**, **no end date**, **wage 0**, **no position at 20** (only 15 to 19), or only **SW**: render without errors and with the fallbacks in Global Constraints (Tasks 2, 9, 12).

## File structure

```
index.html                         Vite entry (Spanish, no CDN)
vite.config.ts                     React plugin, dev middleware for /snapshot.json
src/planner/main.tsx               mounts <App/>
src/planner/domain/positions.ts    codes, groups, colours, snapshot->prototype mapping, proposal
src/planner/domain/ownerData.ts    OwnerData type, defaults, parse/migrate, OWNER_VERSION
src/planner/domain/squad.ts        PlannerPlayer, marks applied, fit, cover
src/planner/domain/season.ts       base year from game date, labels, tabs window, age/expiry
src/planner/domain/money.ts        currency formatting
src/planner/domain/tactics.ts      presets, slot labels, remap
src/planner/domain/depth.ts        bands: pick, move, remove
src/planner/domain/stats.ts        charts, XI totals, KPIs
src/planner/domain/table.ts        columns, views, filter, sort
src/planner/domain/reconcile.ts    owner data against a new snapshot
src/planner/state/reducer.ts       PlannerState, actions, reducer
src/planner/state/storage.ts       OwnerStorage, SnapshotSource, memory and localStorage implementations
src/planner/ui/*.tsx               App, Header, SettingsModal, SeasonTabs, TacticPanel, Pitch, SlotEditor, Analysis, SquadTable, PlayerDetail
src/planner/ui/styles.css          the prototype's CSS (lines 10-162), unchanged class names
tests/planner/*.test.ts(x)
```

---

### Task 1: Tooling and an empty app

**Files:** Create `index.html`, `vite.config.ts`, `src/planner/main.tsx`, `src/planner/ui/App.tsx`, `src/planner/ui/styles.css`, `tests/planner/app.test.tsx`. Modify `package.json`, `tsconfig.json`, `vitest.config.ts`.

**Interfaces:** Produces `App(props: { source: SnapshotSource; storage: OwnerStorage }): JSX.Element` (props typed in Task 10; here the component takes no props). Scripts `dev` (`vite`), `build:ui` (`vite build`).

- [ ] **Step 1: Install** `react react-dom @fontsource/barlow @fontsource/barlow-condensed` and dev `vite @vitejs/plugin-react @types/react @types/react-dom jsdom @testing-library/react @testing-library/jest-dom`.
- [ ] **Step 2: Failing test** `tests/planner/app.test.tsx` (header comment `// @vitest-environment jsdom`): `it("renders the app title")` renders `<App/>` and expects text "FM24 Companion".
- [ ] **Step 3: Run** `npm test -- tests/planner/app.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement.** `tsconfig.json`: add `"jsx": "react-jsx"`, `"lib": ["ES2023","DOM","DOM.Iterable"]`; keep `types: ["node"]`. `vitest.config.ts`: include `tests/**/*.test.{ts,tsx}`. `styles.css` is the prototype's `<style>` content verbatim. `App` returns a heading.
- [ ] **Step 5: Run** the test, then `npm test` and `npm run typecheck`. Expected: PASS, all existing 66 importer tests still pass, typecheck clean.
- [ ] **Step 6: Commit** `build: add React, Vite and the empty planner app`.

---

### Task 2: Positions and the player model

**Files:** Create `src/planner/domain/positions.ts`, `src/planner/domain/squad.ts`, `tests/planner/positions.test.ts`.

**Interfaces:**
- Produces `type Pos = "POR"|"DFI"|"DFC"|"DFD"|"CRI"|"CRD"|"MC"|"MEI"|"MEC"|"MED"|"MPI"|"MPC"|"MPD"|"DLC"`; consts `GROUP: Record<Pos, Group>`, `GCOL`, `GLIST`, `VAR`, `ROLES: Record<Pos,string[]>` (copied from prototype lines 528-558); `fromSave(code: PositionCode): Pos | null` (SW gives null; the rest is the prototype's `V1MAP`); `proposePositions(ratings: Record<PositionCode,number>): { natural: Pos[]; covers: Pos[] }`.
- Produces `interface PlannerPlayer { uid; name; fullName; birthDate; squad: SquadKind; ca; contract; natural: Pos[]; covers: Pos[]; marked: boolean; snap: SnapshotPlayer }`, `buildPlayer(p: SnapshotPlayer, squad: SquadKind, mark?: Mark): PlannerPlayer`, `fitOf(p, code: Pos): "nat"|"near"|"out"`.
- `type Mark = { natural: Pos[]; covers: Pos[]; hidden?: boolean }` (owner mark for one uid; `hidden` = removed from the squad view).

- [ ] **Step 1: Failing tests** (`positions.test.ts`):
  - `fromSave` maps all 14 non-SW codes per `V1MAP` and returns `null` for `"SW"`.
  - `proposePositions`: ratings `{DC:20, DR:17, DL:14, ...1}` gives natural `["DFC"]`, covers `["DFD"]` (DL 14 excluded). Two 20s give two naturals.
  - No 20 anywhere (best is `AMC:18`, `ST:16`): natural is the single highest `["MPC"]`, covers `["DLC"]` (16 ≥ 15).
  - SW at 20 and nothing else ≥ 15: natural falls back to the highest **mapped** position (SW ignored), never an empty array.
  - `buildPlayer` with a `Mark` uses the mark and sets `marked: true`; without one uses the proposal.
  - `fitOf` returns `nat` for a natural, `near` for a cover, `out` otherwise.
- [ ] **Step 2: Run.** Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both files. Tie-breaks in the fallback: highest rating, then the order of `Object.keys(GROUP)`.
- [ ] **Step 4: Run** the file, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): position model and player builder`.

---

### Task 3: Owner data: schema, defaults, loading policy

**Files:** Create `src/planner/domain/ownerData.ts`, `tests/planner/ownerData.test.ts`.

**Interfaces:**
- Produces `OWNER_VERSION = 1`; `type CurrencyCode = "GBP"|"USD"|"EUR"`; `interface Slot { code: Pos; x: number; y: number; uid: number|null; role: string|null; alt: (number|null)[] }`; `interface Plan { tacticId: string; slots: Slot[]; dirty: boolean }`; `interface CustomTactic { id: string; name: string; slots: Slot[] }`; `interface SavedView { id: string; name: string; cols: string[] }`;
- `interface OwnerData { version: 1; settings: { team: string; c1: string; c2: string; currency: CurrencyCode; usdPerGbp: number; eurPerGbp: number; seasonEndOverride: number|null }; marks: Record<number, Mark>; plans: Record<number, Plan>; custom: CustomTactic[]; views: SavedView[]; cols: string[]; viewId: string|null; includeYouth: boolean; known: Record<number, { name: string }>; lastSeason: number|null }`;
- `defaultOwnerData(): OwnerData` (team "Mi equipo", `#0b5d3b`, `#f2b84b`, currency `USD`, 1.2492, 1.17);
- `parseOwnerData(text: string): { ok: true; data: OwnerData } | { ok: false; reason: "invalid"|"newer"; message: string }`.

- [ ] **Step 1: Failing tests:** `defaultOwnerData` has version 1 and the defaults above. `parseOwnerData("{")` gives `invalid`. A document with `version: 2` gives `newer` and a message naming both versions. A valid v1 document round-trips through `JSON.stringify`. Bad fields are repaired field by field (colour not `#rrggbb` gets the default; `usdPerGbp` ≤ 0 gets the default; a `Plan` whose slots are not 11 is dropped; unknown `cols` entries are removed, empty gets the Básica view) without throwing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Repair rules mirror the prototype's `clean`/`okc`/`validCols` (lines 859-895). No migration from the prototype's browser storage.
- [ ] **Step 4: Run** the file, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): owner data schema and loader`.

---

### Task 4: Seasons, ages, expiry, money

**Files:** Create `src/planner/domain/season.ts`, `src/planner/domain/money.ts`, `tests/planner/season-money.test.ts`.

**Interfaces:**
- `seasonEndYear(gameDate: string): number` (month ≥ July gives year+1, else year; 2025-04-06 gives 2025).
- `seasonLabel(endYear: number): string` ("2024/25" style from the prototype's `yearLabel`: `(y-1) + "/" + String(y).slice(2)`).
- `baseSeason(data: OwnerData, gameDate: string): number` (the override when set, else `seasonEndYear`). `tabs(base): [number, number, number]`.
- `ageAt(birthDate: string, gameDate: string, seasonOffset: number): number` (age on the game date plus the offset).
- `expiryYear(end: string|null): number|null`; `expiryWarn(end, seasonEnd): boolean` (end year < season end year).
- `money(gbpWeek: number, s: OwnerData["settings"]): string`: prototype `money` rules (lines 1162-1167: `K` above 1e3, `M` above 1e6, decimal comma) with the symbol of the currency and the rate applied.

- [ ] **Step 1: Failing tests:** `seasonEndYear("2025-04-06")` = 2025, `("2025-07-01")` = 2026, `("2025-06-30")` = 2025. `seasonLabel(2026)` = "2025/26". `baseSeason` honours the override. `ageAt("2000-05-10","2025-04-06",0)` = 24 and with offset 2 = 26. `expiryWarn("2026-05-31", 2026)` false, `(…, 2027)` true, `(null, 2027)` false. `money(30, usd)` = "$37" (30 × 1.2492 rounded); `money(30, gbp)` = "£30"; `money(25000, usd)` = "$31K"; `money(900000, gbp)` = "£900K"; `money(1500000, gbp)` = "£1,5M"; `money(0, usd)` = "$0".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): seasons, ages and currency`.

---

### Task 5: Tactics

**Files:** Create `src/planner/domain/tactics.ts`, `tests/planner/tactics.test.ts`.

**Interfaces:** Produces `PRESETS: { id: string; name: string; slots: Slot[] }[]` (the eight of prototype lines 583-594, `uid: null`, `alt: []`); `slotLabels(slots): string[]` (lines 664-677); `remap(old: Slot[], tpl: Slot[]): Slot[]` (lines 697-710: same code first with role and depth, then same group player only); `blankSlots(tpl: Slot[]): Slot[]`.

- [ ] **Step 1: Failing tests:** each preset has 11 slots, exactly one `POR`, coordinates within 0..100. `slotLabels` for 4-4-2 gives `["POR","DFI","DFCI","DFCD","DFD","MEI","MECI","MECD","MED","DLCI","DLCD"]`; for 4-3-3 with a single `DLC` gives `"DLC"`. `remap` 4-4-2 to 4-3-3 keeps a `DFC` starter in a `DFC` slot with his role and `alt`, moves a `MEC` to the other `MEC`, and an extra winger to a `CEN` slot only if the group matches; **no slot is filled that had no player** (no auto-fill).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** by porting the named prototype functions (same logic, `uid` instead of `pid`).
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): formations, labels and remap`.

---

### Task 6: Depth bands

**Files:** Create `src/planner/domain/depth.ts`, `tests/planner/depth.test.ts`.

**Interfaces:** `BAND` and `BANDS` (lines 623-629); `bandsOf(slot): Bands`; `withBands(slot, b): Slot`; `pickInto(slots: Slot[], slotIndex: number, uid: number, band: BandId): { slots: Slot[]; message: string|null }` (the `pick` rules of lines 973-1014 without the UI cursor logic: moving a player already starting elsewhere swaps; a full band returns the message `"<Título>: franja completa (n/n). Quitá a alguien primero."` and leaves slots unchanged); `moveInBand(slot, band, i, dir)`; `removeInBand(slot, band, i)`.

- [ ] **Step 1: Failing tests:** `bandsOf` of a slot with `alt: [a, null, b]` gives `s:[a]`, `r:[b]`. Picking `u` as titular when `u` starts in slot 3 swaps the two titulars. Picking a third suplente returns the full-band message and slots deep-equal the input. Moving `s[0]` down swaps order; moving past the end changes nothing. Removing the titular leaves `uid: null`, keeps `alt`. Picking a player already in the target band changes nothing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (immutably: return new slots, never mutate the input).
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): depth bands`.

---

### Task 7: State and reducer

**Files:** Create `src/planner/state/reducer.ts`, `tests/planner/reducer.test.ts`.

**Interfaces:**
- `interface PlannerState { data: OwnerData; players: PlannerPlayer[]; gameDate: string; season: number; sel: number|null; view: number|null; band: BandId; bandMsg: string; posMsg: string; scope: "squad"|"xi"; filter: string; q: string; sortKey: string; sortDir: 1|-1; showAll: boolean }` (`season` is an absolute end year; `view` is a `uid`).
- `type Action` as a discriminated union with at least: `setSeason`, `copyPlan` (from the base season into the selected one), `selectTactic(id)`, `saveNewTactic(name)`, `updateTactic`, `deleteTactic`, `moveSlot(i,x,y)`, `selectSlot(i|null)`, `pick(uid, slotIndex?, band?)`, `moveInBand`, `removeInBand`, `setRole`, `clearSlot`, `clearXI`, `cyclePos(uid, code)`, `setPrimary(uid, code)`, `setView`, `toggleCol`, `saveView(name)`, `deleteView`, `setSettings(patch)`, `loadSnapshot` (replaces `players`, `gameDate`, reconciled data; see Task 8), `toggleYouth`.
- `reduce(state: PlannerState, a: Action): PlannerState` (pure). Selector `activePlan(state): Plan` (creates a plan lazily: an unseen season clones the base season's plan, else 4-4-2 empty).

- [ ] **Step 1: Failing tests** (one per action, using small hand-built states): switching to an unseen season clones the current plan into `data.plans[season]` and keeps the old one; `copyPlan` is a no-op on the base season; `selectTactic("433")` remaps and sets `dirty:false`; dragging a slot sets `dirty:true`; `saveNewTactic("")` names it "Táctica 1", name is cut at 32 chars; `deleteTactic` falls back to 4-4-2; `clearXI` empties `uid` but keeps roles; `cyclePos` cycles not covered, natural, covers, not covered and writes `data.marks[uid]`; removing the **last** natural gives `posMsg` "Dejá al menos una posición natural: primero marcá otra como natural." and no change; `toggleCol` never empties the column list and sets `viewId: null`; `setSettings({currency:"EUR"})` keeps plans untouched.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** by porting the prototype methods (lines 915-1126) onto the Task 5 and 6 helpers. IDs for new tactics and views come from an injected `newId()` in the action payload, so the reducer stays pure.
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): planner state and reducer`.

---

### Task 8: Reconcile owner data with a new snapshot

**Files:** Create `src/planner/domain/reconcile.ts`, `tests/planner/reconcile.test.ts`. Modify `src/planner/state/reducer.ts` (`loadSnapshot`).

**Interfaces:** `reconcile(data: OwnerData, snap: Snapshot): { data: OwnerData; players: PlannerPlayer[]; left: number[]; season: number }`. It (a) builds `players` for the three squads with `buildPlayer` and `data.marks`, (b) records `known[uid] = { name }` for every uid that appears in any plan, (c) sets `lastSeason`, (d) returns `left` = uids in plans that are absent from the snapshot, (e) never deletes a plan, a slot, a mark, a tactic or a view. Selector `isLeft(state, uid): boolean`.

- [ ] **Step 1: Failing tests** (each is a Review Focus line):
  - A plan references uid 7 and the new snapshot lacks it: `left` contains 7, `data.plans` is deep-equal to the input, `known[7].name` is the old name, and the reducer renders no exception.
  - A mark for uid 5 (natural `["DFC"]`) with a snapshot whose ratings now propose `["DFD"]`: the built player has natural `["DFC"]` and `marked: true`.
  - Snapshot dated 2026-08-01 after `lastSeason` 2025: `season` is 2027, `tabs` is 2027..2029, `data.plans[2025]` still exists.
  - Unchanged inputs are not mutated (`structuredClone` before, deep-equal after).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**; make the reducer's `loadSnapshot` call `reconcile`.
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): reconcile owner data with a new snapshot`.

---

### Task 9: Derived views: statistics, KPIs, table

**Files:** Create `src/planner/domain/stats.ts`, `src/planner/domain/table.ts`, `tests/planner/stats-table.test.ts`.

**Interfaces:**
- `chartsFor(players, slots, scope, season, gameDate, settings): Chart[]` (three charts of lines 1213-1228: count, weekly wages, average age by group of the **first natural** position; a player without a mapped position is skipped).
- `xiTotals(...)` (filled count, average age, wage total, average CA).
- `kpis(players, club: { id: number; nationOrdinal: number }): { total: number; local: number; of: number; approximate: true }` over **first-team** players only: total = any `homeGrownClubs` entry with `clubId === club.id`; local = any `homeGrownNations` entry with `nationOrdinal === club.nationOrdinal`. (Approximation labelled in the UI; spec section 7.)
- `COLS`, `VIEWS` (lines 561-577), `visibleRows(players, state, slotOf): PlannerPlayer[]` (search by name or position code, group filter, sort rules of lines 1235-1247; the default list is the first team plus Reservas and Sub-18 only when `includeYouth`).
- `statusLabel(code: number|null): string|null` (only the seven labelled codes).

- [ ] **Step 1: Failing tests:** `chartsFor` over three players of known wages and ages gives expected totals and `–` for an empty group; `kpis` on a fixture with 2 of 4 players having `{clubId: club.id}` gives `total: 2`, and counts a player whose entry is for another club as 0; `visibleRows` excludes reserves unless `includeYouth`, filters `DEF`, searches "dfc" case-insensitively, sorts by wage descending, and by `xi` puts non-XI last; `statusLabel(4)` = "Jugador de plantilla", `statusLabel(7)` and `(null)` = `null`. A player with no contract renders wage 0 and expiry `–` in the row model (Review Focus 5).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): charts, KPIs and table model`.

---

### Task 10: Storage seams and app loading

**Files:** Create `src/planner/state/storage.ts`, `src/planner/ui/Loading.tsx`, `tests/planner/storage.test.tsx`. Modify `vite.config.ts` (dev middleware: `GET /snapshot.json` reads `out/snapshot.json`, 404 if absent), `src/planner/main.tsx`, `App.tsx`.

**Interfaces:**
- `interface SnapshotSource { load(): Promise<Snapshot> }`; `interface OwnerStorage { read(): Promise<string|null>; write(text: string): Promise<void> }`.
- `memoryStorage(initial?: string): OwnerStorage`; `localStorageStorage(key = "fm24companion.owner"): OwnerStorage`; `fetchSnapshotSource(url = "/snapshot.json"): SnapshotSource` (validates with `isSnapshot`).
- `App` props: `{ source: SnapshotSource; storage: OwnerStorage; newId?: () => string }`. Flow: read storage, `parseOwnerData`, load snapshot, `reconcile`, render. Saves are debounced (300 ms) after each reducer change and flushed on unmount.

- [ ] **Step 1: Failing tests** (jsdom, `memoryStorage`): (a) valid snapshot and empty storage renders the planner and writes a v1 document after a change; (b) storage holding `{"version":2}` renders an error "Los datos propios son de una versión más nueva de la app" and **`write` is never called** (spy), even after interactions; (c) storage holding `{` renders the invalid-data error, `write` never called; (d) a snapshot that fails `isSnapshot` renders "El snapshot no es válido" and no planner; (e) the snapshot's `warnings` render in a dismissible banner.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The error screens offer no "reset" action in this plan (plan 3 decides backup and reset).
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): storage and snapshot seams, app loading`.

---

### Task 11: UI part 1: header, settings, seasons, tactics, pitch

**Files:** Create `Header.tsx`, `SettingsModal.tsx`, `SeasonTabs.tsx`, `TacticPanel.tsx`, `Pitch.tsx` in `src/planner/ui/`; `tests/planner/ui-left.test.tsx`. Port the prototype template (lines 165-520) for these regions, keeping class names so `styles.css` applies unchanged.

**Interfaces:** Components take `{ state: PlannerState; dispatch: (a: Action) => void }`. The header shows team name, club name from `meta`, game date, and a **"Cargar save"** button that calls an optional prop `onLoadSave?: () => void` (hidden when absent; plan 3 wires it). Settings contains: team, "año en que termina la temporada" (override, empty = automatic), two colours with swap and reset, **currency selector (£, $, €) with editable rates**.

- [ ] **Step 1: Failing tests:** season tabs show `2025/26`, `2026/27`, `2027/28` for a snapshot dated 2025-09-01 and clicking the second dispatches `setSeason(2027)`; changing currency to `€` in Settings re-renders a wage with the € symbol; the pitch renders 11 tokens with accessible names like the prototype's (`Puesto DFCI, …, vacío`), a token for a player out of position shows `!`, a "covers" player shows `~`; arrow keys nudge a focused token by 2 within 6..94 and 5..96; a slot with fewer than two natural players among starter and first backup shows the alert dot; "Vaciar XI" asks for confirmation before dispatching `clearXI`; an unsaved change shows "Cambios sin guardar".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Pointer drag on the pitch is ported from `onDown/onMove/onUp` (lines 935-958) with `setPointerCapture`; jsdom lacks layout, so pointer drag is checked in Task 13, not here.
- [ ] **Step 4: Run** the file and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): header, settings, season tabs, tactics and pitch`.

---

### Task 12: UI part 2: slot editor, analysis, squad table, player detail, KPIs

**Files:** Create `SlotEditor.tsx`, `Analysis.tsx`, `SquadTable.tsx`, `PlayerDetail.tsx`, `RowDrag.ts` in `src/planner/ui/`; `tests/planner/ui-right.test.tsx`. Port template lines 165-520 for these regions.

**Interfaces:** same props as Task 11. `RowDrag.ts` exports `useRowDrag(onDropToSlot, onDropToBand)` (pointer-based, prototype lines 849-855 and 814-846) used by table rows, candidate rows and band items. The detail panel shows: name, positions, age, wage, **CA as "Rtg"**, contract end, squad number, squad status label (only if labelled), the position-mark cycler (three states per position, 14 positions), the primary-position chips, "poner como …" and "quitar del plantel" (hides the player from the table; stored as `Mark.hidden`, Task 2). A player flagged `isLeft` shows "ya no está en la plantilla" in the detail, in the slot's candidate band and in the table row, and cannot be picked into new slots.
The KPI cards read `kpis(...)`; each shows the count, "de N", and the caption "Aproximado: club formador = el club; liga local = nación del club".

- [ ] **Step 1: Failing tests:** selecting a slot shows role chips for its position and 4 bands with counts `0/1`, `0/2`, `0/3`, `0`; picking from the candidate list fills the titular band; the candidate list defaults to naturals and covers, "Mostrar todas las posiciones" adds the rest, and Reservas/Sub-18 players appear only after "Mostrar Reservas y Sub-18"; the table honours the selected view's columns, search and sort header click toggles the arrow; a player with no contract shows `–` in Contrato and `$0` wage without throwing; expiring contracts show `▲` for a season later than the end year; a left player shows the "ya no está" text and its pick button is disabled; KPI cards show `2` and `de 4` for the Task 9 fixture and the caption; the status label appears only for a labelled code.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file and `npm test`; `npm run typecheck`. Expected: PASS and clean.
- [ ] **Step 5: Commit** `feat(planner): slot editor, analysis, squad table, detail and KPIs`.

---

### Task 13: Real-data check, docs, and a visual pass against the prototype

**Files:** Create `tests/planner/real-snapshot.test.ts` (skips when `out/snapshot.json` is absent). Modify `docs/README.md` (map), `docs/06-mockup-to-save-mapping.md` (status of each row: built / approximate), `CLAUDE.md` (one line on `npm run dev`).

- [ ] **Step 1: Failing test:** with the Aberdeen snapshot, `reconcile(defaultOwnerData(), snap)` yields 69 players (31 + 5 + 33), every player has at least one natural position, no throw, `kpis` gives `total` 5 and `local` 10 over the first team (documented approximation values from `docs/06`).
- [ ] **Step 2: Run** (after `npm run import -- "saves/<save>.fm" out/snapshot.json` if the file is absent). Expected: FAIL first only if the test is written before the wiring exists; otherwise note in the ledger that it passed immediately and pins existing behaviour.
- [ ] **Step 3: Manual verification** with `npm run dev`: open the page next to `design/Artboard-7agu.dc.html`; check, and record in the ledger, each of: season tabs, preset switch remaps players, drag a token, drag a row onto a token, bands and reorder, candidate list toggles, charts for squad and XI, the four views and the column picker, saved view, saved tactic update and delete, position mark cycling, Settings (currency, colours), reload keeps everything, loading the same snapshot again keeps everything.
- [ ] **Step 4: Docs** edits listed above. Run `npm test` and `npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit** `docs: planner UI status and run instructions`.

---

## Rulings and calls made in this plan (open to change)

- UI framework **React 19 + Vite** (the prototype is React; Vite is already a Vitest dependency).
- Auto-fill is dropped everywhere (formation change only remaps); the XI starts empty.
- SW has no prototype equivalent and is ignored; a player with no 20 gets his single best mapped position as natural.
- One shared toggle includes Reservas and Sub-18 in the table, charts, and candidates (generalises "show U18"); KPIs always use the first team.
- `€` default rate 1.17 per £; default currency `$`.
- "Quitar del plantel" hides a player through an owner mark; it never edits the snapshot.
- Fonts are bundled, not loaded from a CDN (no network calls).
- No migration of the prototype's browser storage (it only held sample data).

## Out of scope (plan 3)

Electron shell and `Cargar save` wiring (importer as a child process with progress), owner data file in the application data folder, backup and reset for refused data files, the `.exe` installer, and the `uid` stability check with a second save.
