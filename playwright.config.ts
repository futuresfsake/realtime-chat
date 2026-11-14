import { defineConfig } from "@playwright/test";

// End-to-end tests drive the real page in real browsers against a real server
// (see e2e/fixtures.ts, which starts one per test). They are separate from the
// fast unit and integration tests: `npm test` does not run them.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    // Locally this uses the Edge that ships with Windows, so nothing has to be
    // downloaded. Set E2E_BROWSER=chromium after `npx playwright install chromium`.
    channel: process.env.E2E_BROWSER === "chromium" ? undefined : "msedge",
    trace: "retain-on-failure",
  },
});
