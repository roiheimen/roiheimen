/**
 * Display Pages Tests
 *
 * Tests display pages (gfx.html, screen.html, fullscreen.html):
 * - Pages load with meeting-scoped JWT
 * - Sak titles display correctly
 * - Participant access via invite
 */

import { test, expect } from "../fixtures";
import {
  uniqueSlug,
  uniqueMeetingId,
  createVerifiedUserFast,
  loginUserFast,
  createOrganizationDirect,
  createMeetingDirect,
  createInviteCodeDirect,
  joinMeetingDirect,
  getMeetingTokenDirect,
  setMeetingJwt,
  createSakDirect,
} from "../helpers";

test("display pages with owner JWT", async ({ page }) => {
  // Setup: owner, org, meeting
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  // Get meeting token and set it
  const jwt = await getMeetingTokenDirect(page, meetingId);
  await setMeetingJwt(page, jwt);

  // Create a sak for display
  await createSakDirect(page, meetingId, "Display Test Sak");

  await test.step("gfx.html loads and displays sak title", async () => {
    await page.goto(`/gfx.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Display Test Sak");

    // No errors should occur
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  await test.step("screen.html loads and displays sak title", async () => {
    await page.goto(`/screen.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Display Test Sak");

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  await test.step("fullscreen.html loads and displays sak title", async () => {
    await page.goto(`/fullscreen.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Display Test Sak");

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });
});

test("display pages with participant JWT (via invite)", async ({ page }) => {
  // Setup: owner, org, meeting
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  const invite = await createInviteCodeDirect(page, meetingId);

  // Store owner's token
  const ownerJwt = await getMeetingTokenDirect(page, meetingId);

  // Create participant and join via invite
  const participant = await createVerifiedUserFast(page, "Deltaker");
  await loginUserFast(page, participant.email, participant.password);
  await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

  // Get participant's meeting token
  const participantJwt = await getMeetingTokenDirect(page, meetingId);

  // Use owner's token to create a sak
  await setMeetingJwt(page, ownerJwt);
  await createSakDirect(page, meetingId, "Deltaker-test Sak");

  // Use participant's token to access display pages
  await setMeetingJwt(page, participantJwt);

  await test.step("participant can access gfx.html", async () => {
    await page.goto(`/gfx.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title", { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for subscriptions

    const titleElement = await page.locator("roi-gfx-title h1");
    const titleText = await titleElement.textContent();

    expect(titleText).toContain("Deltaker-test Sak");

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    expect(errors.length).toBe(0);
  });

  await test.step("participant can access screen.html", async () => {
    await page.goto(`/screen.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Deltaker-test Sak");
  });

  await test.step("participant can access fullscreen.html", async () => {
    await page.goto(`/fullscreen.html?m=${meetingId}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Deltaker-test Sak");
  });
});
