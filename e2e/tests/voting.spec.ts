/**
 * Voting Tests
 *
 * Tests the voting workflow using the new organization/invite-based auth system.
 */

import { test, expect } from "../fixtures";
import {
  query,
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

test("voting workflow with admin and participant", async ({ browser }) => {
  // Create two separate browser contexts for admin and participant
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();

  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();

  try {
    // Setup: Create admin user, org, meeting
    const admin = await createVerifiedUserFast(adminPage, "Admin");
    await loginUserFast(adminPage, admin.email, admin.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(adminPage, slug, "Testorganisasjon");
    const meetingId = uniqueMeetingId();
    await createMeetingDirect(adminPage, org.id, meetingId, "Testavstemming 2025");

    // Generate invite code for participant
    const invite = await createInviteCodeDirect(adminPage, meetingId);

    // Get admin's meeting token and create sak
    const adminJwt = await getMeetingTokenDirect(adminPage, meetingId);
    await setMeetingJwt(adminPage, adminJwt);
    const sak = await createSakDirect(adminPage, meetingId, "Sak 1: Testavstemming");

    // Setup participant
    const participant = await createVerifiedUserFast(participantPage, "Deltakar");
    await loginUserFast(participantPage, participant.email, participant.password);
    await joinMeetingDirect(participantPage, meetingId, invite.code, "Test Deltakar");
    const participantJwt = await getMeetingTokenDirect(participantPage, meetingId);
    await setMeetingJwt(participantPage, participantJwt);

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

      // Participant selects "Ja" and submits
      await participantPage.click('input[type="radio"][value="Ja"]');
      await participantPage.click('input[type="submit"][name="vote"]');

      // Verify vote was recorded
      await expect(participantPage.locator("text=Du har roysta")).toBeVisible({ timeout: 10000 });
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
    const admin = await createVerifiedUserFast(adminPage, "Admin");
    await loginUserFast(adminPage, admin.email, admin.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(adminPage, slug, "Testorg");
    const meetingId = uniqueMeetingId();
    await createMeetingDirect(adminPage, org.id, meetingId, "Hemmeleg avstemming");

    const invite = await createInviteCodeDirect(adminPage, meetingId);

    const adminJwt = await getMeetingTokenDirect(adminPage, meetingId);
    await setMeetingJwt(adminPage, adminJwt);
    await createSakDirect(adminPage, meetingId, "Sak 1: Hemmeleg val");

    // Setup participant
    const participant = await createVerifiedUserFast(participantPage, "Deltakar");
    await loginUserFast(participantPage, participant.email, participant.password);
    await joinMeetingDirect(participantPage, meetingId, invite.code, "Hemmeleg Deltakar");
    const participantJwt = await getMeetingTokenDirect(participantPage, meetingId);
    await setMeetingJwt(participantPage, participantJwt);

    await test.step("admin creates closed referendum", async () => {
      await adminPage.goto(`/manage.html?id=${meetingId}`);
      await adminPage.waitForSelector("roi-manage", { timeout: 10000 });

      // Use 'V' (uppercase) for closed/secret referendum
      const adderInput = adminPage.locator('input[name="adder"]');
      await adderInput.fill("VHemmeleg val? @For @Mot");
      await adminPage.click('input[type="submit"][value="Legg til"]');

      await adminPage.waitForSelector("roi-referendum-list", { timeout: 10000 });
      await expect(adminPage.locator("text=Hemmeleg val?")).toBeVisible({ timeout: 10000 });

      // Verify it's marked as closed
      await expect(adminPage.locator("text=closed")).toBeVisible({ timeout: 5000 });

      await adminPage.click('button[name="start"]');
    });

    await test.step("participant votes in closed referendum", async () => {
      await participantPage.goto(`/queue.html?m=${meetingId}`);
      await participantPage.waitForSelector("roi-queue", { timeout: 10000 });
      await participantPage.waitForSelector("roi-referendum", { timeout: 10000 });

      await participantPage.click('input[type="radio"][value="For"]');
      await participantPage.click('input[type="submit"][name="vote"]');

      await expect(participantPage.locator("text=Du har roysta")).toBeVisible({ timeout: 10000 });
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
