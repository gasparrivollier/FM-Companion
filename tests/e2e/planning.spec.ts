import { expect, test } from "@playwright/test";
import { closeAndWait, drag, cleanup, launch, loadSave, slot, tableRow, writeFakeSave } from "./support/app.ts";

test.afterEach(cleanup);

test("first launch: load a save and see the squad", async () => {
  const { app, page, dataDir } = await launch();
  await expect(page.getByRole("button", { name: "Cargar save" }).first()).toBeVisible();
  await expect(page.getByText("Jugador Uno")).toHaveCount(0);
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  await expect(tableRow(page, "Jugador Uno")).toBeVisible();
  await expect(page.getByText("Club E2E").first()).toBeVisible();
  await closeAndWait(app);
});

test("drag a table row onto a pitch slot, move a token, change formation and currency", async () => {
  const { app, page, dataDir } = await launch();
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));

  await expect(slot(page, 0)).not.toHaveAttribute("aria-label", /Jugador Uno/);
  await drag(page, tableRow(page, "Jugador Uno"), slot(page, 0));
  await expect(slot(page, 0)).toHaveAttribute("aria-label", /Jugador Uno/);

  await drag(page, tableRow(page, "Jugador Cuatro"), slot(page, 1));
  await expect(slot(page, 1)).toHaveAttribute("aria-label", /Jugador Cuatro/);

  // dragging a token moves the slot on the pitch (it does not swap players)
  const posOf = () => slot(page, 5).evaluate((e) => (e as HTMLElement).style.left + "," + (e as HTMLElement).style.top);
  const posBefore = await posOf();
  const pitch = page.locator(".pitch");
  const box = (await pitch.boundingBox())!;
  const tok = (await slot(page, 5).boundingBox())!;
  await page.mouse.move(tok.x + tok.width / 2, tok.y + tok.height / 2);
  await page.mouse.down();
  await page.mouse.move(tok.x + tok.width / 2 + 10, tok.y + tok.height / 2 + 10, { steps: 3 });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 10 });
  await page.mouse.up();
  await expect.poll(posOf).not.toEqual(posBefore);

  const before = await page.locator("button[data-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await page.getByRole("button", { name: "4-4-2" }).click();
  await page.getByRole("button", { name: /^4-3-3/ }).click();
  await expect(page.getByRole("button", { name: "4-3-3" }).first()).toBeVisible();
  const after = await page.locator("button[data-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(after).not.toEqual(before);

  await expect(page.locator("body")).not.toContainText("€");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByLabel("Moneda").selectOption("EUR");
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Cerrar" }).click();
  await expect(page.locator("body")).toContainText("€");
  await closeAndWait(app);
});
