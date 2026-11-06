#!/usr/bin/env bash
# Rebuilds every intermediate file used by the tools from one FM24 save. Run from the repo root.
#   usage: tools/prepare.sh "saves/<your save>.fm"
# needs: node >= 22 (type stripping), python >= 3.14 (stdlib zstd) with numpy, and the vendored parser in vendor/FM-SaveLens-24
set -euo pipefail
SAVE="${1:?usage: tools/prepare.sh <save.fm>}"
mkdir -p out out/m
echo "[1/4] parser dump (players, clubs)";        node --max-old-space-size=6000 tools/savelens-dump.ts  "$SAVE" out/save.json
echo "[2/4] team table and per-player team value"; node --max-old-space-size=6000 tools/savelens-teams.ts "$SAVE" out/teams.json
echo "[3/4] members needed from the container";   python3 -I tools/fm_members.py "$SAVE" extract out   game_db.dat
python3 -I tools/fm_members.py "$SAVE" extract out/m tactics_man.dat save_game_summary.dat humans.dat
echo "[4/4] extractor self-check against the screenshot ground truth"; python3 -I tools/fm_contracts_eval.py
