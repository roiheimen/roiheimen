/**
 * Auth Setup for Playwright
 *
 * This setup project creates a verified user and saves the authenticated state.
 * Tests that depend on this setup will start with a logged-in user.
 *
 * Note: Most tests create their own users because they need fresh org/meeting
 * data. This setup is useful for tests that just need "any logged-in user"
 * without specific resource ownership requirements.
 */

import { test as setup, expect, createVerifiedUser, loginUser } from "./fixtures";

const authFile = ".playwright-auth/user.json";

setup("authenticate", async ({ page }) => {
  // Navigate to app first to establish browser context for fetch requests
  await page.goto("/");

  // Create a verified user using fast API method
  const user = await createVerifiedUser(page, "SharedAuth");

  // Login using fast method
  await loginUser(page, user.email, user.password);

  // Verify login worked
  const hasJwt = await page.evaluate(() => {
    const creds = JSON.parse(localStorage.getItem("creds") || "{}");
    return !!creds.jwt;
  });
  expect(hasJwt).toBe(true);

  // Save storage state (includes localStorage with JWT)
  // Note: We're on "/" already, and localStorage is set. That's enough for auth state.
  await page.context().storageState({ path: authFile });
});
