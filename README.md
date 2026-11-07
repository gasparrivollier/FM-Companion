# FM24 Companion

A squad and tactics planner for Football Manager 24, for Windows. It reads your `.fm` save game and lets you lay out an XI, plan depth per position, and look ahead at ageing and expiring contracts for the current and the next two seasons.

**Status: work in progress.** The save importer, the planner UI and the Electron desktop app are built and tested on Linux, and a GitHub Actions workflow builds the Windows installer. The installer itself has **not yet been run on Windows**: see the check list in [`docs/09-distribution.md`](docs/09-distribution.md). There is no released download yet.

## Principles

- **The save is the only input.** The tool never writes to it.
- **Everything stays on your machine.** No accounts, no server, no network calls.
- **Your own data survives re-imports.** Plans, tactics, views and position judgements are linked to players by `uid`, and loading a newer save never overwrites them.
- The interface is in Spanish.

## What works today

A desktop app (Electron) with the planner from the prototype: load a save, lay out an XI, plan depth per position over three seasons, and keep your own data across newer saves. For development:

```bash
npm install
npm run electron:dev        # Vite + Electron
npm run electron:smoke -- "path/to/your save.fm"   # import a save inside Electron, print the counts
npm run dev                 # planner in a plain browser, reading out/snapshot.json
```

The importer on its own:


The importer reads an FM24 save (build `24.3.0+0`, Zstandard container) and writes a versioned JSON snapshot of the managed club's three squads (first team, Reservas, Sub-18): identity, position familiarity, CA/PA, attributes, contract (wage, end, squad number, squad status) and the raw home-grown relations.

```bash
npm install
npm run import -- "path/to/your save.fm" out/snapshot.json
npm test
```

Requires Node 22.18 or newer. Importing a ~450 MB save takes about 30 seconds and up to ~2 GB of memory. Tests that need a real save look for one in `saves/` (or the `FM_SAVE` environment variable) and are skipped without it. Saves are never committed (`saves/` and `*.fm` are git-ignored).

## Documentation

Start at [`docs/README.md`](docs/README.md): the save container, a data dictionary with a confidence label for every field, validation against the real game, and the design in [`docs/superpowers/specs/`](docs/superpowers/specs/). The visual reference is the prototype in [`design/`](design/).

## Reverse-engineered format

The save format is not documented by its publisher. Everything here was worked out by inspecting saves, and each claim carries a confidence label in the data dictionary. It may break with other game builds; the importer checks the version and warns.

## Third-party code

`src/importer/savelens/` is a pinned copy of the parser from [FM-SaveLens-24](https://github.com/MSalman5230/FM-SaveLens-24) (see `SOURCE.md` there). That repository publishes no license, so this directory is **not** covered by the license below and its terms are unresolved.

## License

The rest of the project is licensed under the GNU General Public License v3.0 ([`LICENSE`](LICENSE)).

Football Manager is a trademark of Sports Interactive / SEGA. This project is not affiliated with or endorsed by them.
