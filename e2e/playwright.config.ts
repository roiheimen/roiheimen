import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["dot"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  timeout: 60000,

  // Global setup runs once before all tests - sets up database and starts servers
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",

  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "on-first-retry" : "off",
  },

  // Output directory for test artifacts (screenshots, traces, videos)
  outputDir: "test-results",

  projects: [
    // Setup project runs first - creates authenticated user
    {
      name: "setup",
      testDir: ".",
      testMatch: /auth\.setup\.ts/,
    },

    // Main tests - most create their own users/orgs for isolation
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
      testIgnore: ["**/user-auth.spec.ts", "**/integration-flows.spec.ts", "**/voting.spec.ts"],
    },

    // Tests that need completely fresh browser state (no pre-auth)
    {
      name: "chromium-no-auth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: ["**/user-auth.spec.ts", "**/integration-flows.spec.ts", "**/voting.spec.ts"],
    },
  ],
});
