# tools

- `savelens-dump.ts`: runs the vendored FM SaveLens 24 TypeScript reference parser (`vendor/FM-SaveLens-24`, git-ignored) on an FM24 save and writes JSON. Needs Node 22+ and the vendored clone: `git clone --depth 1 https://github.com/MSalman5230/FM-SaveLens-24.git vendor/FM-SaveLens-24`.

```bash
node --max-old-space-size=6000 tools/savelens-dump.ts "saves/<save>.fm" out/save.json
```
- `fm_members.py`: list and extract members of an FM24 `.fm` save.
- `fm_contracts.py` + `fm_contracts_eval.py`: **current extractor** for contracts (wage, start, end, squad number, raw squad status, club) from `game_db.dat`; the evaluation script scores it against the screenshot ground truth in `gt_aberdeen.json` and `gt_aberdeen_u18.json`. `contract_probe.py` is the earlier prototype and is superseded.
- `gt_*.json`: ground truth transcribed from in-game screenshots (git-tracked: names and numbers only, no save data).
- `savelens-teams.ts`: exports every player's team value and the team table using the vendored parser's internals (`node tools/savelens-teams.ts "<save>" out/teams.json`).
- `gt_profiles.json`, `gt_reservas_barca.json`, `gt_tactics.json`, `gt_gartenmann.json`, `gt_papela.json`, `gt_stats.json`: ground truth from in-game screenshots.
