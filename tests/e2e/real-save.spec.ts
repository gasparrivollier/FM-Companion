import { existsSync } from "node:fs";
import { basename } from "node:path";
import { expect, test } from "@playwright/test";
import { findSampleSave } from "../helpers/sample.ts";
import { closeAndWait, drag, cleanup, launch, loadSave, slot, tableRow } from "./support/app.ts";

const save = findSampleSave();
test.afterEach(cleanup);

// Runs against the product build and the owner's private save (saves/*.fm or FM_SAVE); skipped when there is none.
test("@real the real importer reads the real save and a plan survives close and reopen", async () => {
  test.skip(!save, "no save in saves/ and FM_SAVE is not set");
  expect(existsSync("dist-electron/importer.cjs") && existsSync("dist/index.html"), "run npm run build:ui && npm run build:electron first").toBe(true);

  const first = await launch({ build: "real" });
  await loadSave(first.page, first.app, save!, 180_000);
  await expect.poll(() => first.page.evaluate(async () => (await (window as any).fm.snapshot.read()) !== null)).toBe(true);
  const counts = await first.page.evaluate(async () => {
    const s = (await (window as any).fm.snapshot.read()) as { squads: Record<string, unknown[]> };
    return { first: s.squads.first.length, reserves: s.squads.reserves.length, u18: s.squads.u18.length };
  });
  expect(counts.first).toBeGreaterThan(0);
  if (/aberdeen/i.test(basename(save!))) expect(counts).toEqual({ first: 31, reserves: 5, u18: 33 });

  const row = first.page.locator('[role="row"].row').nth(1); // row 0 is the header
  const name = (await row.locator("button.namebtn").innerText()).trim();
  await expect(slot(first.page, 0)).not.toHaveAttribute("aria-label", new RegExp(name));
  await drag(first.page, tableRow(first.page, name), slot(first.page, 0));
  await expect(slot(first.page, 0)).toHaveAttribute("aria-label", new RegExp(name));
  await closeAndWait(first.app);

  const second = await launch({ build: "real", dataDir: first.dataDir });
  await expect(slot(second.page, 0)).toHaveAttribute("aria-label", new RegExp(name));
  await closeAndWait(second.app);
});
