# Pinned copy of the FM SaveLens 24 reference parser

- Origin: https://github.com/MSalman5230/FM-SaveLens-24 (`server/parser/`)
- Commit: `6687bd9d4357d8719e27b4e31329de1ecb6b61b0`
- Licence: **none published by the upstream repository.** This directory is not covered by the project's GPL-3.0 licence; its terms are unresolved. If you are the author and object to this copy, please open an issue and it will be removed.
- Local changes (everything else is unmodified):
  - `index.ts`: the version gate goes through `checkFormatVersion` (rejects non-FM24 files, warns on other FM24 builds).
  - `index.ts`: `Player.team`, and `teams`, `db` and `tactics` on the parse result; `tactics_man.dat` is read before the unchanged-file check.
