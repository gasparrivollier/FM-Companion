import { expect, test } from "@playwright/test";
import { cleanup, closeAndWait, launch } from "./support/app.ts";

test.afterEach(cleanup);

test("the e2e build opens on an empty data folder and shows the welcome screen", async () => {
  const { app, page } = await launch();
  await expect(page.getByRole("button", { name: "Cargar save" }).first()).toBeVisible();
  await closeAndWait(app);
});
