import { defineConfig } from "@playwright/test";

// End-to-end tests drive the real Electron app. One worker: each scenario owns a window and a data folder.
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: "list",
  outputDir: "test-results",
});
