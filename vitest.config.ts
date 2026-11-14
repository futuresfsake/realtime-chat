import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Playwright tests in e2e/ are run by `npm run test:e2e`, not here.
    exclude: ["e2e/**", "node_modules/**", "dist/**", "test-results/**"],
  },
});
