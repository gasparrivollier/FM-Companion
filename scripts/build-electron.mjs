// Bundles the three Electron entry points into dist-electron/ with esbuild.
import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist-electron", { recursive: true, force: true });
const common = { bundle: true, platform: "node", target: "node24", format: "cjs", sourcemap: false, logLevel: "info", legalComments: "none" };

await Promise.all([
  build({ ...common, entryPoints: ["src/electron/main.ts"], outfile: "dist-electron/main.cjs", external: ["electron"] }),
  build({ ...common, entryPoints: ["src/electron/preload.ts"], outfile: "dist-electron/preload.cjs", external: ["electron"] }),
  // the importer runs as its own process (Electron as plain Node), so it is one self-contained file
  build({ ...common, entryPoints: ["src/importer/run.ts"], outfile: "dist-electron/importer.cjs" }),
]);
