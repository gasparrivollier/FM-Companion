import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The private sample save: env FM_SAVE, else the first saves/*.fm. Null when absent (integration tests skip). */
export function findSampleSave(): string | null {
  const env = process.env.FM_SAVE;
  if (env && existsSync(env)) return env;
  const dir = join(process.cwd(), "saves");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.toLowerCase().endsWith(".fm"));
  return f ? join(dir, f) : null;
}
