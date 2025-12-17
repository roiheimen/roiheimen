/**
 * Display Pages Tests
 *
 * Tests display pages (gfx.html, screen.html, fullscreen.html):
 * - Pages load with meeting-scoped JWT
 * - Sak titles display correctly
 * - Participant access via invite
 */

import {
  test,
  expect,
  setJwt,
  createAndLoginUser,
  GraphQLClient,
} from "../fixtures";

test("display pages with owner JWT", async ({ page, meetingWithSak }) => {
  const { meeting, sak, meetingJwt } = meetingWithSak;

  // JWT already set by fixture

  await test.step("gfx.html loads and displays sak title", async () => {
    await page.goto(`/gfx.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Sak 1: Test");

    // No errors should occur
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  await test.step("screen.html loads and displays sak title", async () => {
    await page.goto(`/screen.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Sak 1: Test");

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  await test.step("fullscreen.html loads and displays sak title", async () => {
    await page.goto(`/fullscreen.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Sak 1: Test");

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });
});

test("display pages with participant JWT (via invite)", async ({ page, meetingWithSak }) => {
  const { meeting, invite, meetingJwt: ownerJwt, api: ownerApi } = meetingWithSak;

  // Create participant and join via invite
  const participant = await createAndLoginUser(page, "Deltaker");
  const participantApi = new GraphQLClient(page);
  await participantApi.joinMeeting(meeting.id, invite.code, "Test Deltaker");

  // Get participant's meeting token
  const participantJwt = await participantApi.getMeetingToken(meeting.id);

  // Use owner's token to create another sak
  await setJwt(page, ownerJwt);
  await ownerApi.createSak(meeting.id, "Deltaker-test Sak");

  // Use participant's token to access display pages
  await setJwt(page, participantJwt);

  await test.step("participant can access gfx.html", async () => {
    await page.goto(`/gfx.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title", { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for subscriptions

    const titleElement = await page.locator("roi-gfx-title h1");
    const titleText = await titleElement.textContent();

    // Should show either the first or second sak
    expect(titleText).toBeTruthy();

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    expect(errors.length).toBe(0);
  });

  await test.step("participant can access screen.html", async () => {
    await page.goto(`/screen.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toBeVisible();
  });

  await test.step("participant can access fullscreen.html", async () => {
    await page.goto(`/fullscreen.html?m=${meeting.id}`);

    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toBeVisible();
  });
});
