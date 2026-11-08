import { expect, test, type Page } from "@playwright/test";
import { cleanup, closeAndWait, drag, fixViewport, launch, loadSave, slot, tableRow, writeFakeSave } from "./support/app.ts";

test.afterEach(cleanup);

// The planner is one screen: the page itself never scrolls, only panels inside it do.
const pageOverflow = (page: Page) => page.evaluate(() => ({
  y: document.documentElement.scrollHeight - window.innerHeight,
  x: document.documentElement.scrollWidth - window.innerWidth,
}));
const inside = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!;
  const vp = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  return b.x >= 0 && b.y >= 0 && b.x + b.width <= vp[0] && b.y + b.height <= vp[1];
};

for (const size of [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`the page does not scroll at ${size.width}x${size.height}, with the table, a slot or a player open`, async () => {
    const { app, page, dataDir } = await launch();
    await fixViewport(page, size);
    await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));

    expect(await pageOverflow(page), "squad table view").toEqual({ y: 0, x: 0 });
    expect(await inside(page, ".pitch"), "the pitch is fully on screen").toBe(true);

    await tableRow(page, "Jugador Uno").locator("button.namebtn").click(); // player detail below the table
    expect(await pageOverflow(page), "player detail").toEqual({ y: 0, x: 0 });

    await drag(page, tableRow(page, "Jugador Uno"), slot(page, 0));
    await slot(page, 0).click(); // the slot editor replaces the table
    expect(await pageOverflow(page), "slot editor").toEqual({ y: 0, x: 0 });
    await closeAndWait(app);
  });
}

test("the squad table scrolls inside its own panel", async () => {
  const { app, page, dataDir } = await launch();
  await fixViewport(page, { width: 1366, height: 768 });
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  const t = await page.locator(".tscroll").evaluate((e) => ({ scrolls: e.scrollHeight > e.clientHeight, overflow: getComputedStyle(e).overflowY }));
  expect(t).toEqual({ scrolls: true, overflow: "auto" });
  await closeAndWait(app);
});

test("the slot editor and the player detail scroll inside their panels instead of being cut off", async () => {
  const { app, page, dataDir } = await launch();
  await fixViewport(page, { width: 1280, height: 720 });
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  await drag(page, tableRow(page, "Jugador Uno"), slot(page, 0));
  await slot(page, 0).click();
  const styles = await page.evaluate(() => ["Rol y jugador para el puesto elegido", "Detalle del jugador"].map((l) => {
    const e = document.querySelector(`section[aria-label="${l}"]`) as HTMLElement;
    return { l, overflowY: getComputedStyle(e).overflowY };
  }));
  expect(styles).toEqual([{ l: "Rol y jugador para el puesto elegido", overflowY: "auto" }, { l: "Detalle del jugador", overflowY: "auto" }]);
  await closeAndWait(app);
});

test("import warnings take no room: a bell in the header opens them over the page", async () => {
  const { app, page, dataDir } = await launch();
  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A" }));
  const top = async () => (await page.locator(".cols").boundingBox())!.y;
  const before = await top();
  await expect(page.getByRole("button", { name: /Avisos/ })).toHaveCount(0);

  await loadSave(page, app, writeFakeSave(dataDir, { squad: "A", warnings: ["2 players without a current contract.", "Otro aviso de prueba."] }, "w.fm"));
  const bell = page.getByRole("button", { name: "Avisos (2)" });
  await expect(bell).toBeVisible();
  expect(await top(), "the columns did not move: no banner").toBe(before);
  expect(await pageOverflow(page)).toEqual({ y: 0, x: 0 });

  await bell.click();
  const pop = page.getByRole("dialog", { name: "Avisos" });
  await expect(pop).toContainText("2 players without a current contract.");
  expect(await inside(page, '[role="dialog"][aria-label="Avisos"]'), "the popover is not clipped by the header").toBe(true);
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
  await closeAndWait(app);
});
