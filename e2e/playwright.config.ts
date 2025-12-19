import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI === "true";

// In CI, we need TCP connections. Locally, Unix socket with peer auth works.
const DATABASE_URL = "postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test";
const OWNER_DATABASE_URL = CI
  ? "postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test"
  : "postgres:///roiheimen_test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["dot"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  timeout: 60000, // Increased for CI stability

  // Global setup runs once before all tests
  globalSetup: "./global-setup.ts",

  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "on-first-retry" : "off",
  },

  // Output directory for test artifacts (screenshots, traces, videos)
  outputDir: "test-results",

  // Start servers before tests
  webServer: [
    {
      command: "node server.js",
      cwd: "../pkg/server",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL,
        OWNER_DATABASE_URL,
        NODE_ENV: "test",
      },
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npx es-dev-server",
      cwd: "../pkg/web",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],

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
        // storageState: ".playwright-auth/user.json",
      },
      dependencies: ["setup"],
      // Exclude tests that are handled by chromium-no-auth
      testIgnore: ["**/user-auth.spec.ts", "**/integration-flows.spec.ts", "**/voting.spec.ts"],
    },

    // Tests that need completely fresh browser state (no pre-auth)
    // Used for: user-auth tests, registration flow tests, legacy voting tests
    {
      name: "chromium-no-auth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"], // Now depends on setup to ensure servers are fully ready
      testMatch: ["**/user-auth.spec.ts", "**/integration-flows.spec.ts", "**/voting.spec.ts"],
    },
  ],
});
