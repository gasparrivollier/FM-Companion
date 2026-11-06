// Runs the vendored FM SaveLens 24 TypeScript reference parser on a save and writes JSON.
// usage: node tools/savelens-dump.ts "<save.fm>" out/players.json
import { parseSave } from "../vendor/FM-SaveLens-24/server/parser/index.ts";
import { writeFileSync } from "node:fs";
const [, , file, out] = process.argv;
const t = Date.now();
const save: any = parseSave(file);
console.error("parsed in", Date.now() - t, "ms; keys:", Object.keys(save));
writeFileSync(out, JSON.stringify(save));
