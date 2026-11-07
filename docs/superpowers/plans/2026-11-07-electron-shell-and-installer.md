# FM24 Companion: Electron shell and Windows installer (plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the planner in an Electron app for Windows that loads a save through the importer (as a child process), keeps the owner's data in a file that an import never touches, and ships as a single `.exe` installer built on a Windows CI runner.

**Architecture:** Three Electron processes, with all logic in Node-testable modules that do not import `electron`. The **main** process owns the files (`snapshot.json`, `owner.json`) and the importer child process; the **preload** exposes a small typed API (`window.fm`) over IPC; the **renderer** is the plan 2 planner with Electron implementations of its two seams (`SnapshotSource`, `OwnerStorage`) and a new import flow. The importer is bundled to one JavaScript file and run with Electron's own Node (`ELECTRON_RUN_AS_NODE=1`), so the installed app needs no separate Node.

**Tech Stack:** Electron 45 (ships Node 24.22, which has Zstandard in `node:zlib`), esbuild (already inside Vite) for the main, preload and importer bundles, electron-builder (NSIS target only), Vitest, GitHub Actions `windows-latest`.

**Spec:** `docs/superpowers/specs/2026-11-06-fm24-companion-design.md`. Earlier plans: `2026-11-06-importer-and-snapshot.md` (importer, snapshot), `2026-11-06-planner-ui.md` (planner, seams `SnapshotSource` and `OwnerStorage` in `src/planner/state/storage.ts`).

## Global Constraints

- Windows target, developed on Fedora: every path is built with `node:path` and passed to child processes as **arguments, never through a shell**. Paths with spaces, accents and backslashes must work (the sample save is `Theo Walcott - Aberdeen - Canadá.fm`).
- The save is opened **read-only**, only by the importer child process. Nothing writes to it or copies it.
- **No network calls**: no remote content, no auto-update, no telemetry. Navigation away from the app and new windows are blocked; a Content-Security-Policy forbids remote origins.
- Renderer hardening: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the only bridge is `window.fm`.
- Data folder is `app.getPath("userData")` (`%APPDATA%\FM24 Companion` on Windows). Files: `snapshot.json` (replaced as a whole by each import, atomically), `owner.json` (the owner's data, never replaced by an import), `owner.json.bak` (last good copy).
- Installer: **`.exe` only** (NSIS), no `.msi`, **no code signing**, per-user install (no administrator rights). **Uninstalling keeps the data folder.**
- The importer runs with `--max-old-space-size=4096` and must still finish in under 120 seconds on the sample save.
- Owner data is **never lost**: an invalid, unversioned or newer `owner.json` is never overwritten; a reset needs explicit confirmation and first saves a timestamped copy.
- Players are matched by `uid`. TypeScript sources use no enums, namespaces or parameter properties.

## Review Focus

Each line is pinned by a test in the task named.

1. The import **fails midway**, is killed, runs out of memory, or the child exits without `done` or `error`: the previous `snapshot.json` and `owner.json` are untouched, the UI shows a Spanish message, and the planner stays usable with the old snapshot (Tasks 3, 6).
2. `owner.json` is corrupt, unversioned or newer: it is not overwritten; "empezar de cero" only after confirmation and only after a copy exists (Tasks 2, 6).
3. Crash or power loss **during a write**: a leftover `.tmp` file never replaces the real file, and `owner.json.bak` holds the last good document (Task 2).
4. The save path has **spaces, accents or backslashes**, or the user name in the data path has accents (Tasks 3, 4).
5. The window is closed with an edit less than 300 ms old; two writes are issued back to back; "Cargar save" is clicked twice; a second app instance is started (Tasks 1, 4, 6).
6. The renderer tries to navigate to a remote URL or open a window (Task 4).

## File structure

```
src/electron/api.ts            types shared by main, preload and renderer (FmApi, ImportResult, messages)
src/electron/files.ts          atomic JSON write, owner.json read/backup/reset, snapshot.json read   (no electron import)
src/electron/importRunner.ts   spawn the importer, parse its JSON lines, cancel, map failures       (no electron import)
src/electron/ipc.ts            registerIpc(ipcMain-like, deps): the handlers of window.fm            (no electron import)
src/electron/main.ts           app lifecycle, window, single instance, hardening                    (imports electron)
src/electron/preload.ts        contextBridge.exposeInMainWorld("fm", ...)                          (imports electron)
src/planner/state/electron.ts  electronSnapshotSource(), electronOwnerStorage(), electronImporter()
src/planner/ui/ImportFlow.tsx  Cargar save: pick, progress, cancel, result; DataProblem.tsx: refusal screens
scripts/build-electron.mjs     esbuild bundles to dist-electron/ (main.cjs, preload.cjs, importer.cjs)
electron-builder.yml           NSIS only, asarUnpack for the importer
.github/workflows/windows.yml  test, build, upload the .exe artifact
tests/electron/*.test.ts(x)
```

---

### Task 1: Carry-over from plan 2 (renderer)

**Files:** Modify `src/planner/domain/positions.ts`, `src/planner/ui/Planner.tsx`. Create `src/planner/state/writeQueue.ts`. Test `tests/planner/carryover.test.ts(x)`.

**Interfaces:** Produces `createWriteQueue(write: (text: string) => Promise<void>): { enqueue(text: string): Promise<void>; flushNow(text: string): void }` (writes run **one after another in call order**; a failed write does not block the next).

- [ ] **Step 1: Failing tests.** `proposePositions` with ratings in which only `SW` is high and every mapped code is missing (partial object cast) returns `{ natural: ["DFC"], covers: [] }` instead of throwing; a full-ratings `SW:20` player with all else 1 gets natural `["DFC"]` (sweeper falls back to centre-back, not POR). `createWriteQueue`: three `enqueue` calls whose first write resolves last still finish in call order (use deferred promises); a rejected write rejects its own promise and the next write still runs. In jsdom, `Planner` writes the pending text when `pagehide` fires (spy storage called once, no timer wait), and the pending text is written once, not twice, when unmount follows.
- [ ] **Step 2: Run** `npm test -- tests/planner/carryover`. Expected: FAIL.
- [ ] **Step 3: Implement.** `proposePositions`: when no mapped position exists or the best is the sweeper-only case, natural = `["DFC"]`. `Planner` flushes through the queue on `pagehide` and unmount, and `flushNow` is what plan 3's `writeSync` bridge uses at `pagehide` (Task 5 wires it).
- [ ] **Step 4: Run** the file, then `npm test` and `npm run typecheck`. Expected: PASS, all green.
- [ ] **Step 5: Commit** `fix(planner): partial ratings, ordered writes, flush on page hide`.

---

### Task 2: File layer: atomic writes, owner file policy

**Files:** Create `src/electron/api.ts`, `src/electron/files.ts`, `tests/electron/files.test.ts`.

**Interfaces:**
- `writeFileAtomic(path: string, text: string): void` (temporary file in the same folder, then rename; on failure the target is untouched and no temporary file remains).
- `class`-free `ownerFile(dir: string)`: `{ read(): { kind: "missing" } | { kind: "ok"; text: string } ; write(text: string): void; backupAndReset(now: Date): { backupPath: string }; path: string }`. `write` keeps the previous good `owner.json` as `owner.json.bak` before replacing it (only when the current file parses via `parseOwnerData` as ok).
- `readSnapshotFile(dir): unknown` (throws `Error("NO_SNAPSHOT")` when missing, parse error message otherwise).
- `snapshotPath(dir)`.

- [ ] **Step 1: Failing tests** (real temp dirs): atomic write replaces content and leaves only the target in the folder; when the rename is forced to fail the old content stays and no `.tmp` is left; a stale `owner.json.tmp` from a crash is ignored by `read` and removed by the next `write`; `write` creates `owner.json.bak` holding the previous valid document, but **not** when the previous content is invalid (the `.bak` keeps the older good one); `read` on a missing file is `missing`; `backupAndReset` copies the current file to `owner-backup-YYYYMMDD-HHMMSS.json` **before** removing `owner.json`, and refuses (throws) if the copy fails, leaving `owner.json` in place; a folder path containing spaces and `á` works.
- [ ] **Step 2: Run** `npm test -- tests/electron/files`. Expected: FAIL.
- [ ] **Step 3: Implement** with `node:fs` and `node:path` only.
- [ ] **Step 4: Run** the file, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(electron): atomic files and the owner data policy`.

---

### Task 3: Import runner

**Files:** Create `src/electron/importRunner.ts`, `tests/electron/importRunner.test.ts`, `tests/fixtures/fake-importer.mjs`.

**Interfaces:**
- `type ImportResult = { ok: true; warnings: string[] } | { ok: false; code: ImportErrorCode | "CANCELLED" | "CRASHED" | "BUSY"; message: string }`.
- `createImportRunner(opts: { command: string; args: string[]; env?: Record<string, string>; outPath: string; timeoutMs?: number }): { start(savePath: string, onProgress: (percent: number, message: string) => void): Promise<ImportResult>; cancel(): void; running(): boolean }`. The child is started as `spawn(command, [...args, savePath, outPath], { shell: false })`.
- `describeFailure(code: ImportErrorCode | "CANCELLED" | "CRASHED" | "BUSY", detail: string): string` returns the Spanish message for each code (see Step 3).

- [ ] **Step 1: Failing tests** using `tests/fixtures/fake-importer.mjs` (a script that prints scripted JSON lines and exits with a scripted code, chosen by an env var): progress lines reach `onProgress` in order; `done` gives `{ ok: true, warnings }`; an `error` line gives `{ ok: false, code, message }` with the Spanish text; exit **without** `done` or `error` (including a kill signal) gives `CRASHED`; a second `start` while one is running gives `BUSY` and does not spawn; `cancel()` kills the child, gives `CANCELLED`, and the runner is usable again; stdout split mid-line and several JSON lines in one chunk parse correctly; non-JSON noise on stdout is ignored; a save path with spaces and `á` reaches the child intact (the fake echoes `process.argv` back); the `timeoutMs` kills a silent child and gives `CRASHED`.
- [ ] **Step 2: Run** `npm test -- tests/electron/importRunner`. Expected: FAIL.
- [ ] **Step 3: Implement.** Messages (Spanish, one per code): `NOT_A_SAVE` "Ese archivo no es un save de Football Manager 24."; `UNSUPPORTED_VERSION` "Ese save es de otra versión del juego; esta app necesita FM24."; `TRUNCATED` "El save está incompleto o dañado. Probá guardar de nuevo en el juego."; `NO_MANAGED_CLUB` "No se encontró tu club en el save."; `OUT_OF_MEMORY` "Faltó memoria para leer el save. Cerrá otros programas y reintentá."; `SAVE_CHANGED` "El save cambió mientras se leía. Esperá a que el juego termine de guardar y reintentá."; `UNSUPPORTED_SAVE`, `OUTPUT_FAILED`, `INTERNAL` with the detail appended; `CANCELLED` "Importación cancelada."; `CRASHED` "La lectura del save se interrumpió. Tus datos y el plantel anterior siguen intactos."; `BUSY` "Ya hay una importación en curso."
- [ ] **Step 4: Run** the file, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(electron): importer runner with failure handling`.

---

### Task 4: IPC, preload and main process

**Files:** Create `src/electron/ipc.ts`, `src/electron/preload.ts`, `src/electron/main.ts`, `tests/electron/ipc.test.ts`, `tests/electron/main-hardening.test.ts`. Modify `src/electron/api.ts`.

**Interfaces:**
- `FmApi` (in `api.ts`): `owner: { read(): Promise<string | null>; write(text: string): Promise<void>; writeSync(text: string): void; openFolder(): Promise<void>; backupAndReset(): Promise<{ backupPath: string }> }`, `snapshot: { read(): Promise<unknown> }`, `importer: { pickSave(): Promise<string | null>; start(savePath: string): Promise<ImportResult>; cancel(): Promise<void>; onProgress(cb: (percent: number, message: string) => void): () => void }`.
- `registerIpc(ipc: { handle(channel: string, fn: (...a: any[]) => unknown): void; on(channel: string, fn: (...a: any[]) => void): void }, deps: { dir: string; runner: ImportRunner; pickSave(): Promise<string | null>; openFolder(dir: string): Promise<void>; sendProgress(percent: number, message: string): void }): void`.
- `hardenWindow(win: { webContents: { setWindowOpenHandler(fn: () => { action: "deny" }): void; on(ev: "will-navigate", fn: (e: { preventDefault(): void }, url: string) => void): void } }, appUrl: string): void` and `cspHeader(): string`.

- [ ] **Step 1: Failing tests:** with a fake `ipc` and a real temp dir, `owner:write` then `owner:read` round-trips through `files.ts`; `owner:writeSync` writes synchronously; `importer:start` calls the runner with `outPath = <dir>/snapshot.json`, forwards progress to `sendProgress`, and returns the runner's result; a second `importer:start` while running returns `BUSY`; `importer:pickSave` returns what `deps.pickSave` returns; handlers reject path arguments that are not strings; `hardenWindow` makes the window-open handler return `{ action: "deny" }` and calls `preventDefault` for `https://example.com` and for any URL not starting with the app URL; `cspHeader()` contains `default-src 'self'`, `connect-src 'none'` and no `http:` or `https:` source.
- [ ] **Step 2: Run** `npm test -- tests/electron/ipc tests/electron/main-hardening`. Expected: FAIL.
- [ ] **Step 3: Implement** `ipc.ts` and the pure helpers; `main.ts` wires Electron: `app.requestSingleInstanceLock()` (a second instance focuses the first and quits), `BrowserWindow` with the hardening flags, loads `dist/index.html` (`file://`) in production and the Vite dev URL when `ELECTRON_DEV_URL` is set, installs the CSP with `session.webRequest.onHeadersReceived`, blocks `will-navigate` and new windows, shows `dialog.showOpenDialog` filtered to `*.fm` starting at `Documents\Sports Interactive\Football Manager 2024\games` if it exists. The importer command is `process.execPath` with `ELECTRON_RUN_AS_NODE=1` and args `--max-old-space-size=4096 <path to importer.cjs>`. `preload.ts` exposes `window.fm` via `contextBridge`; `writeSync` uses `ipcRenderer.sendSync`.
- [ ] **Step 4: Run** the two files, then `npm test` and `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(electron): IPC, preload and hardened main process`.

---

### Task 5: Renderer integration: seams, import flow, data problems

**Files:** Create `src/planner/state/electron.ts`, `src/planner/ui/ImportFlow.tsx`, `src/planner/ui/DataProblem.tsx`, `tests/electron/renderer.test.tsx`. Modify `src/planner/ui/App.tsx`, `Planner.tsx`, `src/planner/main.tsx`, `tests/planner/ui-left.test.tsx`, `tests/planner/storage.test.tsx`.

**Interfaces:**
- `electronSnapshotSource(fm: FmApi): SnapshotSource`, `electronOwnerStorage(fm: FmApi): OwnerStorage` (its `write` goes through `createWriteQueue`), `electronImporter(fm: FmApi): ImporterPort`.
- `interface ImporterPort { pickSave(): Promise<string | null>; start(path: string): Promise<ImportResult>; cancel(): Promise<void>; onProgress(cb): () => void }`.
- `App` props become `{ source; storage; importer?: ImporterPort; newId?; dataTools?: { backupAndReset(): Promise<{ backupPath: string }>; openFolder(): Promise<void> } }` (the `onLoadSave` prop of plan 2 is replaced by `importer`).
- `Planner` gains `incoming?: Snapshot` (a new snapshot to apply with the `loadSnapshot` action, so edits made since opening are kept).

- [ ] **Step 1: Failing tests** (jsdom, fake `FmApi`):
  - no snapshot yet: the app shows a welcome screen with **Cargar save** (not an error).
  - **Cargar save** → picker returns `null` → nothing happens; returns a path → progress dialog shows the percent and message; on `ok` the new snapshot is applied to the **running** planner (an unsaved change made before is still there) and warnings show in the banner; on `{ ok: false }` the Spanish message shows in a closable alert and the old snapshot stays on screen; clicking **Cargar save** while importing does nothing (second click ignored); **Cancelar** calls `cancel()` and the dialog closes with the cancelled message.
  - `owner.json` invalid or newer: the refusal screen says what happened, shows **Abrir carpeta de datos**, and **Guardar copia y empezar de cero** that asks for a confirmation first; confirming calls `backupAndReset()`, shows the copy's path, and then loads the app; declining calls nothing. No `write` is ever issued on this screen.
  - `pagehide` calls `fm.owner.writeSync` with the pending text exactly once.
- [ ] **Step 2: Run** `npm test -- tests/electron/renderer`. Expected: FAIL.
- [ ] **Step 3: Implement.** `main.tsx` picks the Electron implementations when `window.fm` exists, else the plan 2 dev ones (`fetchSnapshotSource`, `localStorageStorage`) so `npm run dev` in a plain browser still works (the import flow is hidden there). Update the plan 2 tests that used `onLoadSave` to use `importer`.
- [ ] **Step 4: Run** the new file, then `npm test` and `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(planner): Electron seams, import flow and data-problem screens`.

---

### Task 6: Bundles, a real import inside Electron, and the smoke test

**Files:** Create `scripts/build-electron.mjs`, `src/electron/smoke.ts`, `tests/electron/bundle.test.ts`. Modify `package.json` (scripts `build:electron`, `electron:dev`, `electron:smoke`; `main` field).

**Interfaces:** `npm run build:electron` produces `dist-electron/main.cjs`, `preload.cjs`, `importer.cjs` (esbuild, platform node, target node24, `electron` external for main and preload only). `electron:smoke` runs `electron dist-electron/main.cjs --smoke <save> `: it opens no window, runs the importer through the same runner and exits 0 with a one-line JSON summary (`{ players, first, reserves, u18, ms }`), or non-zero.

- [ ] **Step 1: Failing tests** (`bundle.test.ts`, runs the build): after `build:electron` the three files exist; `importer.cjs` run **with plain Node** on the sample save (skips without a save) prints a `done` line and writes a snapshot equal in player counts to `out/snapshot.json` (31, 5, 33); `importer.cjs` with a bad path prints an `error` line with `NOT_A_SAVE` and exits 1; the main bundle does not contain `child_process.exec(` or `shell: true`.
- [ ] **Step 2: Run** `npm test -- tests/electron/bundle`. Expected: FAIL.
- [ ] **Step 3: Implement** the build script and the smoke entry.
- [ ] **Step 4: Run** the file and `npm test`. Then **verify under Electron** on Fedora: `npm run electron:smoke -- "saves/<save>.fm"` with the sample save. Expected: exit 0 and counts 31/5/33 in under 120 s. Record the output in the ledger. If `node:zlib` has no Zstandard inside Electron, stop: that is a plan-breaking finding to report (Electron 45 ships Node 24.22, which has it).
- [ ] **Step 5: Commit** `build(electron): bundles and a smoke test that imports a real save`.

---

### Task 7: Installer config and Windows CI

**Files:** Create `electron-builder.yml`, `.github/workflows/windows.yml`, `tests/electron/builder-config.test.ts`. Modify `package.json` (`dist` script, `build` metadata), `.gitignore` (`dist-electron/`, `release/`).

- [ ] **Step 1: Failing test** reading `electron-builder.yml`: the only Windows target is `nsis`; no `msi` anywhere; `nsis.oneClick` true and `perMachine` false; `nsis.deleteAppDataOnUninstall` is false; `asarUnpack` includes `dist-electron/importer.cjs`; `files` excludes `saves/**`, `out/**`, `*.fm`; `win.signAndEditExecutable` is false (no signing); `productName` is `FM24 Companion`; the workflow file runs on `windows-latest`, runs `npm test` before `npm run dist`, uploads `release/*.exe`, and has no step that publishes a release or uses secrets.
- [ ] **Step 2: Run** `npm test -- tests/electron/builder-config`. Expected: FAIL.
- [ ] **Step 3: Implement** the config and the workflow (triggers: `workflow_dispatch` and tags `v*`; Node 24; `npm ci`; `npm test`; `npm run dist`; `actions/upload-artifact`). `npm run dist` = `build:ui` + `build:electron` + `electron-builder --win nsis`.
- [ ] **Step 4: Run** the file and `npm test`. On Fedora, `npm run dist` is not run (it needs Windows); the CI run is the check: push the branch, run the workflow, and confirm it produced `release/FM24 Companion Setup <version>.exe`. Record the run URL in the ledger.
- [ ] **Step 5: Commit** `build: NSIS installer and Windows CI`.

---

### Task 8: Docs and the Windows check list

**Files:** Create `docs/09-distribution.md`. Modify `README.md`, `docs/README.md`, `docs/07-reproduction.md`, `CLAUDE.md` (one line on `npm run electron:dev` and `npm run dist`).

- [ ] **Step 1: Write** `docs/09-distribution.md`: data folder and files, what an import changes and never changes, how to build the installer (CI) and install it, uninstall keeps data, how to back up `owner.json`, the open item "uid stability across saves" with the exact procedure (`npm run uid-check -- a.json b.json` on two imports of the same career) and what to do if it fails (reconcile by full name plus birth date with manual confirmation), and the **manual Windows check list** the owner runs once: install without admin rights; first run shows the welcome screen; load a save from the game's folder; progress and result; kill the app mid-import and reopen (old data intact); edit, close the window at once, reopen (edit kept); load a newer save (plans kept, a player who left is flagged); uninstall and reinstall (data kept); no firewall prompt appears.
- [ ] **Step 2: Update** the other docs; keep the README honest (what works, what is unverified on Windows).
- [ ] **Step 3: Run** `npm test` and `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 4: Commit** `docs: distribution, data folder and the Windows check list`.

---

## Calls made in this plan (open to change)

- **Electron 45**, bundled with esbuild, importer run through `ELECTRON_RUN_AS_NODE` (no separate Node on the user's PC). The unpacked importer file is the part to watch on Windows.
- **Per-user one-click NSIS installer**, no admin rights, default icon (a custom icon is a later polish), no auto-update.
- Data stays in `%APPDATA%\FM24 Companion` and survives uninstall.
- `owner.json.bak` is a single rolling copy of the last good file; the explicit reset writes a timestamped copy.
- A second app instance focuses the first one.
- The `uid` stability check stays an **owner-supplied evidence item** (needs a second save of the same career); this plan documents the procedure but cannot run it.
- Carry-over minors from plan 2 that stay open: "Quitar del plantel" cannot be undone, left players are not table rows, the saved season-end override does not follow later saves.

## Not covered (needs the owner)

- Running the manual Windows check list on the real PC.
- The second save for the `uid` check and the home-grown research evidence (profiles of Barron, MacKenzie, Considine, Kondolo and a player without a home-grown club).
- A custom application icon and the decision to sign the installer later.
