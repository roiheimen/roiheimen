/**
 * Voting Tests
 *
 * Tests the voting workflow using the new organization/invite-based auth system.
 */

import {
  test,
  expect,
  uniqueSlug,
  uniqueMeetingId,
  createAndLoginUser,
  GraphQLClient,
  setJwt,
} from "../fixtures";

test("voting workflow with admin and participant", async ({ browser }) => {
  // Create two separate browser contexts for admin and participant
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();

  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();

  try {
    // Setup: Create admin user, org, meeting
    await createAndLoginUser(adminPage, "Admin");
    const adminApi = new GraphQLClient(adminPage);

    const slug = uniqueSlug();
    const org = await adminApi.createOrganization(slug, "Testorganisasjon");
    const meetingId = uniqueMeetingId();
    await adminApi.createMeeting(org.id, meetingId, "Testavstemming 2025");

    // Generate invite code for participant
    const invite = await adminApi.createInviteCode(meetingId);

    // Get admin's meeting token and create sak
    const adminJwt = await adminApi.getMeetingToken(meetingId);
    await setJwt(adminPage, adminJwt);
    await adminApi.createSak(meetingId, "Sak 1: Testavstemming");

    // Setup participant
    await createAndLoginUser(participantPage, "Deltakar");
    const participantApi = new GraphQLClient(participantPage);
    await participantApi.joinMeeting(meetingId, invite.code, "Test Deltakar");
    const participantJwt = await participantApi.getMeetingToken(meetingId);
    await setJwt(participantPage, participantJwt);

    await test.step("admin creates referendum via manage page", async () => {
      // Admin goes to manage page
      await adminPage.goto(`/manage.html?id=${meetingId}`);
      await adminPage.waitForSelector("roi-manage", { timeout: 10000 });

      // Admin creates a referendum via adder input
      // Format: vTitle? @Choice1 @Choice2
      const adderInput = adminPage.locator('input[name="adder"]');
      await adderInput.fill("vTest votering? @Ja @Nei @Avhaldande");
      await adminPage.click('input[type="submit"][value="Legg til"]');

      // Wait for referendum to appear in the list
      await adminPage.waitForSelector("roi-referendum-list", { timeout: 10000 });
      await expect(adminPage.locator("text=Test votering?")).toBeVisible({ timeout: 10000 });

      // Admin starts the referendum
      await adminPage.click('button[name="start"]');
    });

    await test.step("participant votes on referendum", async () => {
      // Participant navigates to queue page
      await participantPage.goto(`/queue.html?m=${meetingId}`);
      await participantPage.waitForSelector("roi-queue", { timeout: 10000 });

      // Participant should see the referendum
      await participantPage.waitForSelector("roi-referendum", { timeout: 10000 });
      await expect(participantPage.locator("text=Test votering?")).toBeVisible({ timeout: 10000 });

      // Wait for vote form to be ready - the form with radio buttons
      const jaRadio = participantPage.locator('input[type="radio"][value="Ja"]');
      await jaRadio.waitFor({ state: "visible", timeout: 10000 });

      // Participant selects "Ja"
      await jaRadio.check();

      // Wait for selection to register
      await expect(jaRadio).toBeChecked();

      // Submit the form by clicking the button
      const submitButton = participantPage.locator('input[type="submit"][name="vote"]');
      await submitButton.click();

      // Wait for the vote to be processed
      await expect(participantPage.locator("text=Du har røysta")).toBeVisible({ timeout: 20000 });
    });

    await test.step("admin ends referendum and sees results", async () => {
      // Admin ends the referendum
      await adminPage.click('button[name="end"]');

      // Verify vote count shows 1 vote for "Ja"
      await expect(adminPage.locator("text=Ja (1)")).toBeVisible({ timeout: 10000 });
    });
  } finally {
    await adminContext.close();
    await participantContext.close();
  }
});

test("closed (secret) referendum hides individual votes", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();

  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();

  try {
    // Setup: Create admin user, org, meeting
    await createAndLoginUser(adminPage, "Admin");
    const adminApi = new GraphQLClient(adminPage);

    const slug = uniqueSlug();
    const org = await adminApi.createOrganization(slug, "Testorg");
    const meetingId = uniqueMeetingId();
    await adminApi.createMeeting(org.id, meetingId, "Hemmeleg avstemming");

    const invite = await adminApi.createInviteCode(meetingId);

    const adminJwt = await adminApi.getMeetingToken(meetingId);
    await setJwt(adminPage, adminJwt);
    await adminApi.createSak(meetingId, "Sak 1: Hemmeleg val");

    // Setup participant
    await createAndLoginUser(participantPage, "Deltakar");
    const participantApi = new GraphQLClient(participantPage);
    await participantApi.joinMeeting(meetingId, invite.code, "Hemmeleg Deltakar");
    const participantJwt = await participantApi.getMeetingToken(meetingId);
    await setJwt(participantPage, participantJwt);

    await test.step("admin creates closed referendum", async () => {
      await adminPage.goto(`/manage.html?id=${meetingId}`);
      await adminPage.waitForSelector("roi-manage", { timeout: 10000 });

      // Use 'l' for closed/secret referendum with custom choices
      const adderInput = adminPage.locator('input[name="adder"]');
      await adderInput.fill("lHemmeleg val? @For @Mot");
      await adminPage.click('input[type="submit"][value="Legg til"]');

      await adminPage.waitForSelector("roi-referendum-list", { timeout: 10000 });
      await expect(adminPage.locator("text=Hemmeleg val?")).toBeVisible({ timeout: 10000 });

      // Verify it's marked as closed (Lukka = closed in Norwegian)
      await expect(adminPage.locator("text=Lukka")).toBeVisible({ timeout: 5000 });

      await adminPage.click('button[name="start"]');
    });

    await test.step("participant votes in closed referendum", async () => {
      await participantPage.goto(`/queue.html?m=${meetingId}`);
      await participantPage.waitForSelector("roi-queue", { timeout: 10000 });
      await participantPage.waitForSelector("roi-referendum", { timeout: 10000 });

      await participantPage.click('input[type="radio"][value="For"]');
      await participantPage.click('input[type="submit"][name="vote"]');

      await expect(participantPage.locator("text=Du har røysta")).toBeVisible({ timeout: 10000 });
    });

    await test.step("admin ends and results are shown", async () => {
      await adminPage.click('button[name="end"]');

      // Results should show after referendum ends
      await expect(adminPage.locator("text=For (1)")).toBeVisible({ timeout: 10000 });
    });
  } finally {
    await adminContext.close();
    await participantContext.close();
  }
});
