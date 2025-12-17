import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  timeout: 30000,

  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project runs first - creates authenticated user
    {
      name: "setup",
      testDir: ".",
      testMatch: /auth\.setup\.ts/,
    },

    // Main tests - most create their own users/orgs for isolation
    // but can use shared auth when just needing "any logged-in user"
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Note: storageState commented out since most tests create their own users
        // Uncomment if you have tests that benefit from pre-authenticated state:
        // storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    // Tests that need completely fresh browser state (no pre-auth)
    // Used for: user-auth tests, registration flow tests, legacy voting tests
    {
      name: "chromium-no-auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/user-auth.spec.ts", "**/integration-flows.spec.ts", "**/voting.spec.ts"],
    },
  ],
});
