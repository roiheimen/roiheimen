/**
 * Participant Flow Tests
 *
 * Tests the participant journey:
 * - Admin generates invite → Share link → Participant joins
 * - Participant uses queue.html to add speeches
 * - Admin uses manage.html
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

test("participant invite and join flow", async ({ page }) => {
  // Setup: owner, org, meeting
  const owner = await createVerifiedUserFast(page, "Eigar");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Testorganisasjon");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Testavstemming 2025");

  // Generate invite code
  const invite = await createInviteCodeDirect(page, meetingId);

  // Get owner's meeting token to create sak
  const ownerJwt = await getMeetingTokenDirect(page, meetingId);

  await test.step("admin generates invite and participant joins via direct link", async () => {
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBe(8);

    // Create a participant user
    const participant = await createVerifiedUserFast(page, "Deltakar");
    await loginUserFast(page, participant.email, participant.password);

    // Navigate to direct invite link
    await page.goto(`/i/${invite.code}`);

    // Should redirect to bli-med.html
    await page.waitForURL("**/bli-med.html*", { timeout: 10000 });
    expect(page.url()).toContain(`code=${invite.code}`);

    // Wait for the join component to validate the code
    await page.waitForSelector("roi-join-meeting", { timeout: 10000 });

    // Wait for validation to complete and meeting info to appear
    await page.waitForSelector(".meeting-info", { timeout: 15000 });

    // Verify meeting info is displayed
    const meetingTitle = await page.textContent(".meeting-info h3");
    expect(meetingTitle).toContain("Testavstemming 2025");

    // Wait for the submit button to be enabled
    const submitButton = page.locator('input[type="submit"][value="Bli med"]');
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });

    // Fill in display name and join
    await page.fill('input[name="displayName"]', "Ola Nordmann");
    await submitButton.click();

    // Wait for success screen
    await page.waitForSelector(".success", { timeout: 10000 });

    // Verify success message
    const successText = await page.textContent(".success");
    expect(successText).toContain("Du er no med i motet");

    // Verify participant is in database
    const participantInDb = await query(
      `SELECT display_name, participant_num FROM roiheimen.meeting_participant WHERE meeting_id = '${meetingId}' AND display_name = 'Ola Nordmann'`
    );
    expect(participantInDb).toBeTruthy();
    const [displayName, participantNum] = participantInDb.split("|");
    expect(displayName).toBe("Ola Nordmann");
    expect(parseInt(participantNum, 10)).toBeGreaterThan(0);
  });

  await test.step("participant can access queue.html after joining", async () => {
    // Set owner's JWT to create sak
    await setMeetingJwt(page, ownerJwt);
    const sak = await createSakDirect(page, meetingId, "Sak 1: Valg av møteleder");

    // Create another participant for this step
    const participant2 = await createVerifiedUserFast(page, "Deltakar2");
    await loginUserFast(page, participant2.email, participant2.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltakar 2");

    // Get participant's meeting token
    const participantJwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, participantJwt);

    // Navigate to queue.html
    await page.goto(`/queue.html?m=${meetingId}`);

    // Wait for the queue component
    await page.waitForSelector("roi-queue", { timeout: 10000 });

    // Verify sak title is shown
    await expect(page.locator(".title")).toContainText("Sak 1: Valg av møteleder", { timeout: 10000 });

    // Verify the "Innlegg" button is visible
    const innleggButton = page.locator('button:has-text("Innlegg")');
    await expect(innleggButton).toBeVisible();
  });
});

test("participant queue.html interactions", async ({ page }) => {
  // Setup: owner, org, meeting, invite
  const owner = await createVerifiedUserFast(page, "Eigar");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");
  const invite = await createInviteCodeDirect(page, meetingId);

  // Get owner's meeting token and create sak
  const ownerJwt = await getMeetingTokenDirect(page, meetingId);
  await setMeetingJwt(page, ownerJwt);
  const sak = await createSakDirect(page, meetingId, "Sak 1: Diskusjon");

  // Create participant and join
  const participant = await createVerifiedUserFast(page, "Deltakar");
  await loginUserFast(page, participant.email, participant.password);
  await joinMeetingDirect(page, meetingId, invite.code, "Kari Nordmann");

  // Get participant's meeting token
  const participantJwt = await getMeetingTokenDirect(page, meetingId);
  await setMeetingJwt(page, participantJwt);

  // Navigate to queue.html
  await page.goto(`/queue.html?m=${meetingId}`);
  await page.waitForSelector("roi-queue", { timeout: 10000 });

  await test.step("participant can add speech (innlegg) to speaker list", async () => {
    // Click the "Innlegg" button
    const innleggButton = page.locator('button.main:has-text("Innlegg")');
    await expect(innleggButton).toBeVisible({ timeout: 5000 });
    await innleggButton.click();

    // Verify the "Stryk meg" button appears
    const strykButton = page.locator('button:has-text("Stryk meg")');
    await expect(strykButton).toBeVisible({ timeout: 5000 });

    // Verify speech was added to database
    await expect.poll(async () => {
      const speechInDb = await query(
        `SELECT s.type FROM roiheimen.speech s JOIN roiheimen.person p ON s.speaker_id = p.id WHERE s.sak_id = ${sak.id}`
      );
      return speechInDb.toUpperCase();
    }).toBe("INNLEGG");
  });

  await test.step("participant can remove themselves from speaker list", async () => {
    // The "Stryk meg" button should be visible from previous step
    const strykButton = page.locator('button:has-text("Stryk meg")');
    await expect(strykButton).toBeVisible({ timeout: 5000 });

    // Click "Stryk meg" to remove ourselves
    await strykButton.click();

    // The "Stryk meg" button should no longer be visible
    await expect(strykButton).not.toBeVisible({ timeout: 5000 });

    // Verify speech was marked as ended in database
    await expect.poll(async () => {
      const speechInDb = await query(
        `SELECT ended_at IS NOT NULL as is_ended FROM roiheimen.speech s WHERE s.sak_id = ${sak.id} ORDER BY id DESC LIMIT 1`
      );
      return speechInDb;
    }).toBe("t");
  });

  await test.step("participant can add replikk to speaker list", async () => {
    // Click the "Replikk" button
    const replikkButton = page.locator('button:has-text("Replikk")');
    await expect(replikkButton).toBeVisible({ timeout: 5000 });
    await replikkButton.click();

    // Verify replikk was added to database
    await expect.poll(async () => {
      const speechInDb = await query(
        `SELECT s.type FROM roiheimen.speech s WHERE s.sak_id = ${sak.id} AND ended_at IS NULL ORDER BY id DESC LIMIT 1`
      );
      return speechInDb.toUpperCase();
    }).toBe("REPLIKK");
  });
});

test("admin manage.html features", async ({ page }) => {
  // Setup: owner, org, meeting
  const owner = await createVerifiedUserFast(page, "Eigar");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  // Get meeting token
  const jwt = await getMeetingTokenDirect(page, meetingId);
  await setMeetingJwt(page, jwt);

  // Create a sak to enable the "Meir" button
  await createSakDirect(page, meetingId, "Test Sak");

  // Navigate to manage.html
  await page.goto(`/manage.html?id=${meetingId}`);
  await page.waitForSelector("roi-manage", { timeout: 10000 });

  await test.step("admin can access all tabs in manage.html", async () => {
    // Click "Meir" to open the dialog
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    const dialog = page.locator('dialog[open]');

    // 1. "Lag nye saker" tab (sak)
    const lagNyeSakerTab = dialog.locator('button[name="sak"]');
    await expect(lagNyeSakerTab).toBeVisible();
    await lagNyeSakerTab.click();
    await expect(dialog.locator('textarea[name="saker"]')).toBeVisible({ timeout: 3000 });

    // 2. "Legg inn kommandoer på sak" tab (action)
    const actionTab = dialog.locator('button[name="action"]');
    await expect(actionTab).toBeVisible();
    await actionTab.click();
    await expect(dialog.locator('textarea[name="adderlines"]')).toBeVisible({ timeout: 3000 });

    // 3. "Statistikk" tab (stats)
    const statistikkTab = dialog.locator('button[name="stats"]');
    await expect(statistikkTab).toBeVisible();
    await statistikkTab.click();
    await expect(dialog.locator('h2:has-text("Stats")')).toBeVisible({ timeout: 3000 });

    // 4. "Deltakarar" tab
    const deltakararTab = dialog.locator('button[name="deltakarar"]');
    await expect(deltakararTab).toBeVisible();
    await deltakararTab.click();
    await expect(dialog.locator('.deltakarar-tab')).toBeVisible({ timeout: 3000 });

    // 5. "Invitasjonar" tab
    const invitasjonarTab = dialog.locator('button[name="invitasjonar"]');
    await expect(invitasjonarTab).toBeVisible();
    await invitasjonarTab.click();
    await expect(dialog.locator('.invitasjonar-tab')).toBeVisible({ timeout: 3000 });

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 5000 });
  });

  await test.step("admin can create additional sak via Meir dialog", async () => {
    // Open "Meir" dialog to access bulk sak creation
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    // Go to "Lag nye saker" tab
    const dialog = page.locator('dialog[open]');
    await dialog.locator('button[name="sak"]').click();
    await expect(dialog.locator('textarea[name="saker"]')).toBeVisible({ timeout: 3000 });

    // Enter a new sak title
    await dialog.locator('textarea[name="saker"]').fill('Sak 2: Godkjenning av dagsorden');
    await dialog.locator('input[type="submit"][value="Legg til"]').click();

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 5000 });

    // Verify sak was created in database
    await expect.poll(async () => {
      const sakInDb = await query(
        `SELECT COUNT(*) FROM roiheimen.sak WHERE meeting_id = '${meetingId}' AND title = 'Sak 2: Godkjenning av dagsorden'`
      );
      return parseInt(sakInDb, 10);
    }).toBeGreaterThan(0);
  });

  await test.step("admin can create invite from Invitasjonar tab", async () => {
    // Click "Meir" to open dialog
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    const dialog = page.locator('dialog[open]');
    await dialog.locator('button[name="invitasjonar"]').click();
    await dialog.locator('.invitasjonar-tab').waitFor({ timeout: 3000 });

    // Wait for invite generator to load
    await page.waitForSelector('roi-invite-generator', { timeout: 5000 });

    // Count invites before
    const invitesBefore = await query(
      `SELECT COUNT(*) FROM roiheimen.meeting_invite WHERE meeting_id = '${meetingId}'`
    );

    // Create an invite
    await page.click('roi-invite-generator button[type="submit"]');

    // Wait for success
    await page.waitForSelector('.success-card', { timeout: 10000 });

    // Verify success message
    const successText = await page.textContent('.success-card');
    expect(successText).toContain('Invitasjonskode laga');

    // Verify invite was created
    await expect.poll(async () => {
      const invitesAfter = await query(
        `SELECT COUNT(*) FROM roiheimen.meeting_invite WHERE meeting_id = '${meetingId}'`
      );
      return parseInt(invitesAfter, 10);
    }).toBeGreaterThan(parseInt(invitesBefore, 10));
  });
});
