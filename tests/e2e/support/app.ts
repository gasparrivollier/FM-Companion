// Helpers to launch the built app under Playwright. Each launch gets its own data folder unless one is given.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, type ElectronApplication, type Locator, type Page } from "@playwright/test";

export interface Launched { app: ElectronApplication; page: Page; dataDir: string }
const open = new Set<ElectronApplication>();

/** build "e2e": the scripted importer (npm run build:e2e). "real": the product build (npm run build:ui && npm run build:electron). */
export async function launch(opts: { dataDir?: string; build?: "e2e" | "real"; executablePath?: string } = {}): Promise<Launched> {
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), "fm-e2e-"));
  mkdirSync(dataDir, { recursive: true });
  const dataArgs = opts.executablePath ? [] : [`--user-data-dir=${dataDir}`];
  const app = opts.executablePath
    ? await electron.launch({ executablePath: opts.executablePath, args: [] })
    : await electron.launch({ args: [resolve(opts.build === "real" ? "." : "dist-e2e"), ...dataArgs] });
  open.add(app);
  const page = await app.firstWindow();
  return { app, page, dataDir };
}

/** Closes the way a person does (the window's close button), so the before-close flush really runs, and waits for the process to exit. */
export async function closeAndWait(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const exited = new Promise<void>((res) => proc.once("exit", () => res()));
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close(); });
  await exited;
  open.delete(app);
}

/** For afterEach: kill anything a failed test left behind. */
export async function killLeftovers(): Promise<void> {
  for (const app of open) { try { await app.close(); } catch { /* already gone */ } }
  open.clear();
}

/** Makes the native "open file" dialog answer with this path. */
export async function stubPickSave(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as typeof dialog.showOpenDialog; }, path);
}

export function writeFakeSave(dir: string, spec: { squad: "A" | "B"; hang?: boolean }, name = "save.fm"): string {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(spec));
  return p;
}

/** Loads a save through the UI and waits for the import to finish. */
export async function loadSave(page: Page, app: ElectronApplication, savePath: string, timeout = 30_000): Promise<void> {
  await stubPickSave(app, savePath);
  await page.getByRole("button", { name: "Cargar save" }).first().click();
  await page.getByRole("dialog", { name: "Importando el save" }).waitFor({ state: "hidden", timeout });
}

/** Scrolls until both ends are inside the window, so the mouse never leaves the viewport. */
async function bringBothIntoView(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  for (let i = 0; i < 6; i++) {
    const a = (await from.boundingBox())!;
    const b = (await to.boundingBox())!;
    const h = await page.evaluate(() => window.innerHeight);
    const overflow = Math.max(a.y + a.height, b.y + b.height) - (h - 8);
    const underflow = Math.min(a.y, b.y) - 8;
    if (overflow <= 0 && underflow >= 0) return;
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, overflow > 0 ? overflow : underflow);
    await page.waitForTimeout(50);
  }
}

/** A mouse drag in small steps, because the planner listens to pointer events on the document. */
export async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await bringBothIntoView(page, from, to);
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

export const tableRow = (page: Page, name: string): Locator => page.locator('[role="row"].row', { hasText: name });
export const slot = (page: Page, i: number): Locator => page.locator(`button[data-slot="${i}"]`);
