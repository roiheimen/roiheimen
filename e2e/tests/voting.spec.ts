/**
 * Legacy Voting Tests
 *
 * Tests the legacy num-based authentication and voting workflow
 * using the pre-seeded "meet20" test meeting.
 */

import { test, expect } from "../fixtures";
import { Page } from "@playwright/test";

/**
 * Helper to log in a user via legacy num/password auth.
 * The legacy login uses GraphQL mutations and JavaScript navigation (location.assign),
 * not standard form POST, so we need to wait for the URL change after clicking.
 */
async function legacyLogin(page: Page, num: string, password: string) {
  // First, go to the origin to be able to clear localStorage
  // Use a simple page that won't auto-redirect
  await page.goto("/mote.html?logout", { waitUntil: "domcontentloaded" });

  // Wait a moment for any auto-redirect to start (the logout param should prevent it)
  await page.waitForTimeout(100);

  // Clear localStorage to remove any existing auth
  await page.evaluate(() => localStorage.clear());

  // Navigate to meeting list page (now clean, without any auth redirect)
  await page.goto("/mote.html", { waitUntil: "networkidle" });

  // Wait for meetings to load
  await page.waitForSelector('a[data-id="meet20"]', { timeout: 30000 });

  // Click on the test meeting
  await page.click('a[data-id="meet20"]');

  // Wait for login form to appear
  await page.waitForSelector('input[name="num"]');

  // Fill login form
  await page.fill('input[name="num"]', num);
  await page.fill('input[name="code"]', password);

  // Click submit - this triggers a GraphQL mutation, not a form POST
  await page.click('input[type="submit"]');

  // Wait for JavaScript-based navigation to queue.html
  // The login uses location.assign() after successful auth, which is async
  await page.waitForURL("**/queue.html", { timeout: 30000 });

  // Wait for queue page to be fully loaded
  await page.waitForSelector("roi-queue", { timeout: 30000 });
}

test("legacy login flow", async ({ page }) => {
  await test.step("user can login with valid credentials", async () => {
    await legacyLogin(page, "10", "test");

    // Verify user is on queue page
    await expect(page.locator("roi-queue")).toBeVisible();
  });

  await test.step("admin can access manage page", async () => {
    // Login as admin (num >= 1000)
    await legacyLogin(page, "1000", "test");

    // Navigate to manage page
    await page.goto("/manage.html");

    // Verify manage interface loads
    await expect(page.locator("roi-manage")).toBeVisible();
  });
});

test("voting workflow with admin and participant", async ({ browser }) => {
  // Create two separate browser contexts for admin and participant
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();

  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();

  try {
    await test.step("admin logs in and creates referendum", async () => {
      await legacyLogin(adminPage, "1000", "test");

      // Admin goes to manage page
      await adminPage.goto("/manage.html");
      await adminPage.waitForSelector("roi-manage");

      // Admin creates a referendum via adder input
      // Format: vTitle? @Choice1 @Choice2
      const adderInput = adminPage.locator('input[name="adder"]');
      await adderInput.fill("vTest votering? @Ja @Nei @Avhaldande");
      await adminPage.click('input[type="submit"][value="Legg til"]');

      // Wait for referendum to appear in the list
      await adminPage.waitForSelector("roi-referendum-list");
      await expect(adminPage.locator("text=Test votering?")).toBeVisible();

      // Admin starts the referendum
      await adminPage.click('button[name="start"]');
    });

    await test.step("participant logs in and votes", async () => {
      await legacyLogin(participantPage, "10", "test");

      // Participant should see the referendum on queue page
      await participantPage.waitForSelector("roi-referendum");
      await expect(participantPage.locator("text=Test votering?")).toBeVisible();

      // Participant selects "Ja" and submits
      await participantPage.click('input[type="radio"][value="Ja"]');
      await participantPage.click('input[type="submit"][name="vote"]');

      // Verify vote was recorded
      await expect(participantPage.locator("text=Du har røysta")).toBeVisible();
    });

    await test.step("admin ends referendum and sees results", async () => {
      // Admin ends the referendum
      await adminPage.click('button[name="end"]');

      // Verify vote count shows 1 vote for "Ja"
      await expect(adminPage.locator("text=Ja (1)")).toBeVisible();
    });
  } finally {
    await adminContext.close();
    await participantContext.close();
  }
});
