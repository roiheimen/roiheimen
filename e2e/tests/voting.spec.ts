import { test, expect } from "../fixtures";
import { Page } from "@playwright/test";

/**
 * Helper to log in a user
 */
async function login(page: Page, num: string, password: string) {
  await page.goto("/");

  // Wait for meetings to load and click on "Test" meeting (meet20)
  await page.waitForSelector('a[data-id="meet20"]');
  await page.click('a[data-id="meet20"]');

  // Wait for login form
  await page.waitForSelector('input[name="num"]');

  // Fill login form
  await page.fill('input[name="num"]', num);
  await page.fill('input[name="code"]', password);

  // Submit and wait for navigation to queue
  await Promise.all([
    page.waitForURL("**/queue.html"),
    page.click('input[type="submit"]'),
  ]);

  // Wait for queue page to be fully loaded
  await page.waitForSelector("roi-queue");
}

test.describe("Login flow", () => {
  test("user can login with valid credentials", async ({ page }) => {
    await login(page, "10", "test");

    // Verify user is on queue page
    await expect(page.locator("roi-queue")).toBeVisible();
  });

  test("admin can access manage page", async ({ page }) => {
    await login(page, "1000", "test");

    // Navigate to manage page
    await page.goto("/manage.html");

    // Verify manage interface loads
    await expect(page.locator("roi-manage")).toBeVisible();
  });
});

test.describe("Voting workflow", () => {
  test("admin creates referendum and participant votes", async ({ browser }) => {
    // Create two separate browser contexts for admin and participant
    const adminContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const participantPage = await participantContext.newPage();

    try {
      // Step 1: Admin logs in
      await login(adminPage, "1000", "test");

      // Step 2: Admin goes to manage page
      await adminPage.goto("/manage.html");
      await adminPage.waitForSelector("roi-manage");

      // Step 3: Admin creates a referendum via adder input
      // Format: vTitle? @Choice1 @Choice2
      const adderInput = adminPage.locator('input[name="adder"]');
      await adderInput.fill("vTest votering? @Ja @Nei @Avhaldande");
      await adminPage.click('input[type="submit"][value="Legg til"]');

      // Wait for referendum to appear in the list
      await adminPage.waitForSelector("roi-referendum-list");
      await expect(adminPage.locator("text=Test votering?")).toBeVisible();

      // Step 4: Admin starts the referendum
      await adminPage.click('button[name="start"]');

      // Step 5: Participant logs in
      await login(participantPage, "10", "test");

      // Step 6: Participant should see the referendum on queue page
      await participantPage.waitForSelector("roi-referendum");
      await expect(
        participantPage.locator("text=Test votering?")
      ).toBeVisible();

      // Step 7: Participant selects "Ja" and submits
      await participantPage.click('input[type="radio"][value="Ja"]');
      await participantPage.click('input[type="submit"][name="vote"]');

      // Step 8: Verify vote was recorded
      await expect(participantPage.locator("text=Du har røysta")).toBeVisible();

      // Step 9: Admin ends the referendum
      await adminPage.click('button[name="end"]');

      // Step 10: Verify vote count shows 1 vote for "Ja"
      await expect(adminPage.locator("text=Ja (1)")).toBeVisible();
    } finally {
      await adminContext.close();
      await participantContext.close();
    }
  });
});
