import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { closeAndWait, drag, killLeftovers, launch, loadSave, slot, stubPickSave, tableRow, writeFakeSave } from "./support/app.ts";

test.afterEach(killLeftovers);

test("an edit made right before closing is there after reopening", async () => {
  const first = await launch();
  await loadSave(first.page, first.app, writeFakeSave(first.dataDir, { squad: "A" }));
  await drag(first.page, tableRow(first.page, "Jugador Uno"), slot(first.page, 0));
  await expect(slot(first.page, 0)).toHaveAttribute("aria-label", /Jugador Uno/);
  await closeAndWait(first.app); // no wait for the debounce: the close handshake must flush

  expect(readFileSync(join(first.dataDir, "owner.json"), "utf8")).toContain("9001");
  const second = await launch({ dataDir: first.dataDir });
  await expect(slot(second.page, 0)).toHaveAttribute("aria-label", /Jugador Uno/);
  await closeAndWait(second.app);
});

test("cancelling an import half way leaves the squad, the plans and both files as they were", async () => {
  const { app, page, dataDir } = await launch();
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  await drag(page, tableRow(page, "Jugador Uno"), slot(page, 0));
  await expect.poll(() => existsSync(join(dataDir, "owner.json")) && readFileSync(join(dataDir, "owner.json"), "utf8").includes("9001")).toBe(true);
  const snapBefore = readFileSync(join(dataDir, "snapshot.json"));
  const ownerBefore = readFileSync(join(dataDir, "owner.json"));

  await stubPickSave(app, writeFakeSave(dataDir, { squad: "B", hang: true }, "hang.fm"));
  await page.getByRole("button", { name: "Cargar save" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Importando el save" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();

  await expect(slot(page, 0)).toHaveAttribute("aria-label", /Jugador Uno/);
  await expect(tableRow(page, "Jugador Nuevo")).toHaveCount(0);
  expect(readFileSync(join(dataDir, "snapshot.json")).equals(snapBefore)).toBe(true);
  expect(readFileSync(join(dataDir, "owner.json")).equals(ownerBefore)).toBe(true);
  await closeAndWait(app);
});

test("importing a different squad keeps the plans, flags who left and shows who arrived", async () => {
  const { app, page, dataDir } = await launch();
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  await drag(page, tableRow(page, "Jugador Dieciocho"), slot(page, 2));
  await drag(page, tableRow(page, "Jugador Uno"), slot(page, 0));
  await expect(slot(page, 2)).toHaveAttribute("aria-label", /Jugador Dieciocho/);
  await expect(slot(page, 2)).not.toHaveAttribute("aria-label", /ya no está en la plantilla/);

  await loadSave(page, app, writeFakeSave(dataDir, { squad: "B" }, "b.fm"));
  await expect(slot(page, 2)).toHaveAttribute("aria-label", /ya no está en la plantilla/);
  await expect(slot(page, 0)).toHaveAttribute("aria-label", /Jugador Uno/);
  await expect(tableRow(page, "Jugador Nuevo")).toBeVisible();
  await expect(tableRow(page, "Jugador Nuevo")).not.toHaveClass(/xi/);
  await closeAndWait(app);
});

test("a corrupt owner.json is explained and never rewritten", async () => {
  const dir = (await launch()).dataDir;
  await killLeftovers();
  const bad = "{not json";
  writeFileSync(join(dir, "owner.json"), bad);
  const { app, page } = await launch({ dataDir: dir });
  await expect(page.getByRole("alert")).toContainText("No se pueden cargar tus datos");
  await closeAndWait(app);
  expect(readFileSync(join(dir, "owner.json"), "utf8")).toBe(bad);
  expect(existsSync(join(dir, "owner.json.bak"))).toBe(false);
});
