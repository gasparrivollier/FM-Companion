import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("the built app opens on an empty data folder and shows the welcome screen", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "fm-e2e-"));
  const app = await electron.launch({ args: [".", `--user-data-dir=${dataDir}`] });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("button", { name: "Cargar save" }).first()).toBeVisible();
  } finally {
    await app.close();
  }
});
