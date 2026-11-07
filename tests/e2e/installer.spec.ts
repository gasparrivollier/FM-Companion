import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { cleanup, closeAndWait, launch, slot } from "./support/app.ts";
import { squadA } from "./support/squads.ts";

test.afterEach(cleanup);

const APP = "FM24 Companion"; // file names of the installed exe and uninstaller (productName)
// a per-user one-click NSIS install goes to %LOCALAPPDATA%\Programs\<package name>, and Electron keeps data in %APPDATA%\<package name>
const PKG = (JSON.parse(readFileSync("package.json", "utf8")) as { name: string }).name;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(what: string, ok: () => boolean, ms = 120_000): Promise<void> {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(500);
  }
}

// Windows only, in CI after `npm run dist`. Installs the real installer silently, runs the installed app on seeded data
// (the installed importer is the real one and there is no save to read), then uninstalls and checks the data stays.
test("@installer silent install, run the installed app, uninstall, keep the data", async () => {
  test.skip(process.platform !== "win32", "Windows only");
  test.skip(!process.env.CI, "installs, runs and uninstalls the real app and overwrites its data folder: CI only");
  test.setTimeout(10 * 60_000);
  const setup = readdirSync("release").find((n) => /^FM24 Companion Setup .*\.exe$/.test(n));
  expect(setup, "run npm run dist first").toBeTruthy();

  const installDir = join(process.env.LOCALAPPDATA!, "Programs", PKG);
  const exe = join(installDir, `${APP}.exe`);
  const uninstaller = join(installDir, `Uninstall ${APP}.exe`);
  let userData = "";
  try {
    const inst = spawnSync(join("release", setup!), ["/S"], { stdio: "inherit", timeout: 180_000 });
    expect(inst.error, "installer failed to start").toBeUndefined();
    expect(inst.status, "installer exit status").toBe(0);
    await until("the installed exe", () => existsSync(exe));

    // first run: learn where the installed app keeps its data, then seed it
    const first = await launch({ executablePath: exe });
    userData = await first.app.evaluate(({ app }) => app.getPath("userData"));
    expect(userData.endsWith(PKG), "docs/09-distribution.md names the data folder").toBe(true);
    await closeAndWait(first.app);
    writeFileSync(join(userData, "snapshot.json"), JSON.stringify(squadA()));
    writeFileSync(join(userData, "owner.json"), JSON.stringify(defaultOwnerData()));

    const second = await launch({ executablePath: exe });
    await expect(second.page.locator('[role="row"].row', { hasText: "Jugador Uno" })).toBeVisible({ timeout: 30_000 });
    await expect(slot(second.page, 0)).toBeVisible();
    await closeAndWait(second.app);
  } finally {
    spawnSync("taskkill", ["/IM", `${APP}.exe`, "/F"]);
    if (existsSync(uninstaller)) spawnSync(uninstaller, ["/S"], { timeout: 120_000 });
  }
  await until("the uninstall", () => !existsSync(exe), 120_000);
  expect(userData, "the data folder was found").not.toBe("");
  expect(existsSync(join(userData, "owner.json"))).toBe(true);
});
