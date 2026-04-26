import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 5_000
  },
  forbidOnly: true,
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  reporter: "list",
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:47291",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "bun packages/cli/src/bin.ts run --source tmp/e2e-source --port 47291",
    reuseExistingServer: false,
    timeout: 10_000,
    url: "http://127.0.0.1:47291"
  }
});
