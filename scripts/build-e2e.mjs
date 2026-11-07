// Builds dist-e2e/: the product's main, preload and UI, with only the importer swapped for the scripted one.
// Run `npm run build:ui` first (the `build:e2e` script does).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist-e2e", { recursive: true, force: true });
mkdirSync("dist-e2e/dist-electron", { recursive: true });
const common = { bundle: true, platform: "node", target: "node24", format: "cjs", sourcemap: false, logLevel: "info", legalComments: "none" };

await Promise.all([
  build({ ...common, entryPoints: ["src/electron/main.ts"], outfile: "dist-e2e/dist-electron/main.cjs", external: ["electron"] }),
  build({ ...common, entryPoints: ["src/electron/preload.ts"], outfile: "dist-e2e/dist-electron/preload.cjs", external: ["electron"] }),
  build({ ...common, entryPoints: ["tests/e2e/support/e2e-importer.ts"], outfile: "dist-e2e/dist-electron/importer.cjs" }),
]);
cpSync("dist", "dist-e2e/dist", { recursive: true });
writeFileSync("dist-e2e/package.json", JSON.stringify({ name: "fm24-e2e", version: "0.0.0", main: "dist-electron/main.cjs" }) + "\n");
