# 09. Distribution: the desktop app, its data folder and the installer

How FM24 Companion is packaged and where it keeps things. Written with plan 3 (`docs/superpowers/plans/2026-11-07-electron-shell-and-installer.md`).

## 1. What runs where

| Process | What it does | Code |
|---|---|---|
| Main | Owns the files and the importer child process, opens the window | `src/electron/main.ts`, `ipc.ts`, `files.ts`, `importRunner.ts` |
| Preload | The only bridge the page can reach: `window.fm` | `src/electron/preload.ts`, `api.ts` |
| Renderer | The planner (plan 2) with Electron implementations of its two seams | `src/planner/` |
| Importer | Reads the save, writes `snapshot.json`; run with Electron's own Node, so no separate Node install is needed | `src/importer/run.ts`, bundled to `dist-electron/importer.cjs` |

The window is sandboxed (`contextIsolation`, `sandbox`, no Node integration), a Content-Security-Policy allows only the app's own files and no network, new windows and navigation away from the app are blocked, and a second launch focuses the first window. The app makes **no network calls**.

## 2. The data folder

`%APPDATA%\fm24-companion` on Windows (Electron's `userData`, named after the package, not the product name).

| File | What | Replaced by |
|---|---|---|
| `snapshot.json` | What the importer read from the save: the three squads | each import, as a whole and atomically |
| `owner.json` | **Your data**: plans, tactics, views, position marks, settings, known names | only by the app as you edit; **never by an import** |
| `owner.json.bak` | The last good copy of `owner.json`, made before each write | each write (only when the file being replaced is valid) |
| `owner-backup-YYYYMMDD-HHMMSS.json` | A copy made when you choose "Guardar copia y empezar de cero" | never |

What an import changes: only `snapshot.json`. The running planner then applies it: players who are no longer in the squad stay in your plans, flagged "ya no está en la plantilla"; new players appear unassigned; your position marks win over what the save suggests.

If an import fails, is cancelled, runs out of memory or the process dies, the previous `snapshot.json` and your `owner.json` are untouched and the planner keeps showing the old squad.

If `owner.json` is unreadable, has no version, or comes from a newer app, the app shows what happened and **writes nothing**. You can open the folder, or save a copy and start from scratch (it asks first, and refuses to reset if the copy cannot be made).

To back your data up by hand, copy `owner.json`.

## 3. Building the installer

The installer is one `.exe` (NSIS), per user, no administrator rights, **not code signed** (Windows SmartScreen may warn on first run). Uninstalling keeps the data folder.

It is built on a Windows runner, not on Linux: the workflow `.github/workflows/windows.yml` runs the tests and `npm run dist`, and attaches `release/FM24 Companion Setup <version>.exe` to the run as an artifact. Start it from the Actions tab ("Run workflow") or by pushing a tag `v*`. It publishes nothing and needs no credentials.

On a Windows machine with Node 24: `npm ci`, `npm run dist`.

For development on any system: `npm run electron:dev` (Vite dev server plus Electron), `npm run electron:smoke -- "saves/<save>.fm"` (imports a save inside Electron without a window and prints the counts), `npm run electron:smoke-ui` (loads the built page in a hidden window with the real security settings and checks it reaches the welcome screen).

## 4. Open item: are `uid`s stable across saves?

Everything the owner makes is keyed by the player `uid`. That the `uid` stays the same between two saves **of the same career** is **not verified** (only one save has been seen). To check, import two saves of one career and compare:

```bash
npm run import -- "saves/<save A>.fm" out/a.json
npm run import -- "saves/<save B>.fm" out/b.json
npm run uid-check -- out/a.json out/b.json
```

`changedIdentity` should be 0 and `sameIdentity` should be close to the number of players present in both. If `uid`s turn out to be unstable, the fallback is to reconcile by full name plus date of birth, asking for confirmation on ambiguous cases. That change would go in `reconcile` (`src/planner/domain/reconcile.ts`).

## 5. Check list to run once on the Windows PC

The automated tests and the checks on Fedora cannot cover these. Tick them off after installing:

- [ ] The installer runs without asking for administrator rights.
- [ ] First launch shows the welcome screen with **Cargar save**.
- [ ] **Cargar save** opens the game's saves folder (`Documents\Sports Interactive\Football Manager 2024\games`); loading your save shows progress and then the squad (about 30 seconds).
- [ ] Place players on the pitch, switch formation, change the currency in Ajustes.
- [ ] Close the window **right after an edit**, reopen: the edit is there.
- [ ] Start a load and close the app in the middle, reopen: the squad and your plans are as before.
- [ ] Load a newer save of the same career: your plans are still there; a player who left is flagged; new players appear.
- [ ] Uninstall and reinstall: the data is still there (`%APPDATA%\fm24-companion`).
- [ ] No firewall prompt appears at any point.

## 6. End-to-end tests

They drive the real Electron app with Playwright (real window, preload, CSP and importer child process). Design: `docs/superpowers/specs/2026-11-07-e2e-design.md`.

| Command | What it runs | Needs |
|---|---|---|
| `npm run build:e2e && npm run e2e` | Six scenarios on an *e2e build* (`dist-e2e/`): the product's main, preload and UI, with only the importer replaced by a scripted one that writes an invented squad | nothing private |
| `npm run build:ui && npm run build:electron && npm run e2e:real` | The product build with the real importer on your save (`saves/*.fm` or `FM_SAVE`); skipped when there is none | your save |
| `npm run e2e:installer` | Windows and `CI=1` only (it overwrites the app's real data folder): silent install of `release/FM24 Companion Setup *.exe`, run the installed app on seeded data, uninstall, check the data folder stays | `npm run dist` first |

The Windows workflow runs the first and the third after building the installer and keeps `test-results/` as an artifact.

What the scenarios cover: load a squad; drag a row onto the pitch and a token around it; change formation and currency; close right after an edit and reopen; cancel an import half way (both files byte-identical); import a different squad (plans kept, leaver flagged, newcomer unassigned); a corrupt `owner.json` (explained, never rewritten).

Each scenario uses its own data folder (`--user-data-dir`). The installer scenario is the only one that uses the real `%APPDATA%`, and it runs on the CI runner.

What they do not cover: importing your real save on Windows (the `e2e:real` run is local), the SmartScreen warning, and the visual look. If a pointer drag proves unstable on a runner, that test is marked `test.fixme` with the reason, not weakened.
