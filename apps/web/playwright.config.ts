import { defineConfig, devices } from "@playwright/test"

// E2E per __docs/TESTING.md: full stack against the local dev environment —
// both dev servers are booted automatically (reused if already running).
// Requires the demo org to be seeded (`pnpm --filter @vc/db db:seed`).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // specs share one seeded demo org — keep them ordered
  workers: 1,
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // The core (read-heavy) specs assert exact seeded values, so they must run
  // before the admin specs, which create signups and award points.
  projects: [
    { name: "core", use: { ...devices["Desktop Chrome"] }, testMatch: /demo\.spec\.ts/ },
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /admin\.spec\.ts/,
      dependencies: ["core"],
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @vc/api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @vc/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
    },
  ],
})
