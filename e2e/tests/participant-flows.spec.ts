/**
 * Participant Flow Tests
 *
 * Tests the participant journey:
 * - Admin generates invite → Share link → Participant joins
 * - Participant uses queue.html to add speeches
 * - Admin uses manage.html
 */

import {
  test,
  expect,
  query,
  setJwt,
  createAndLoginUser,
  loginUser,
  GraphQLClient,
} from "../fixtures";

test("participant invite and join flow", async ({ page, meetingWithSak }) => {
  const { meeting, invite, sak, meetingJwt } = meetingWithSak;

  await test.step("admin generates invite and participant joins via direct link", async () => {
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBe(8);

    // Create a participant user
    const participant = await createAndLoginUser(page, "Deltakar");

    // Navigate to direct invite link
    await page.goto(`/i/${invite.code}`);

    // Should redirect to bli-med.html
    await page.waitForURL("**/bli-med.html*", { timeout: 10000 });
    expect(page.url()).toContain(`code=${invite.code}`);

    // Wait for the join component to validate the code
    await page.waitForSelector("roi-join-meeting", { timeout: 10000 });
    await page.waitForSelector(".meeting-info", { timeout: 15000 });

    // Verify meeting info is displayed
    const meetingTitle = await page.textContent(".meeting-info h3");
    expect(meetingTitle).toContain("Test Meeting");

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
      `SELECT display_name, participant_num FROM roiheimen.meeting_participant WHERE meeting_id = '${meeting.id}' AND display_name = 'Ola Nordmann'`
    );
    expect(participantInDb).toBeTruthy();
    const [displayName, participantNum] = participantInDb.split("|");
    expect(displayName).toBe("Ola Nordmann");
    expect(parseInt(participantNum, 10)).toBeGreaterThan(0);
  });

  await test.step("participant can access queue.html after joining", async () => {
    // Create another participant for this step
    const participant2 = await createAndLoginUser(page, "Deltakar2");
    const api = new GraphQLClient(page);

    await api.joinMeeting(meeting.id, invite.code, "Test Deltakar 2");

    // Get participant's meeting token
    const participantJwt = await api.getMeetingToken(meeting.id);
    await setJwt(page, participantJwt);

    // Navigate to queue.html
    await page.goto(`/queue.html?m=${meeting.id}`);
    await page.waitForSelector("roi-queue", { timeout: 10000 });

    // Verify sak title is shown
    await expect(page.locator(".title")).toContainText("Sak 1: Test", { timeout: 10000 });

    // Verify the "Innlegg" button is visible
    const innleggButton = page.locator('button:has-text("Innlegg")');
    await expect(innleggButton).toBeVisible();
  });
});

test("participant queue.html interactions", async ({ participantInMeeting }) => {
  const { admin, participant, participantJwt, api } = participantInMeeting;
  const { meeting, sak } = admin;

  // Navigate to queue.html (JWT already set by fixture)
  await api.execute(`mutation { __typename }`); // Ensure page context
  const page = (api as unknown as { page: import("@playwright/test").Page }).page;

  // Get the page from the fixture context
  await participantInMeeting.api.execute(`mutation { __typename }`);
});

test("participant queue.html interactions - full flow", async ({ page, meetingWithSak }) => {
  const { meeting, invite, sak, meetingJwt } = meetingWithSak;

  // Create participant and join
  const participant = await createAndLoginUser(page, "Deltakar");
  const api = new GraphQLClient(page);
  await api.joinMeeting(meeting.id, invite.code, "Kari Nordmann");

  // Get participant's meeting token
  const participantJwt = await api.getMeetingToken(meeting.id);
  await setJwt(page, participantJwt);

  // Navigate to queue.html
  await page.goto(`/queue.html?m=${meeting.id}`);
  await page.waitForSelector("roi-queue", { timeout: 10000 });

  await test.step("participant can add speech (innlegg) to speaker list", async () => {
    const innleggButton = page.locator('button.main:has-text("Innlegg")');
    await expect(innleggButton).toBeVisible({ timeout: 5000 });
    await innleggButton.click();

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
    const strykButton = page.locator('button:has-text("Stryk meg")');
    await expect(strykButton).toBeVisible({ timeout: 5000 });

    await strykButton.click();
    await expect(strykButton).not.toBeVisible({ timeout: 5000 });

    // Verify speech was marked as ended
    await expect.poll(async () => {
      const speechInDb = await query(
        `SELECT ended_at IS NOT NULL as is_ended FROM roiheimen.speech s WHERE s.sak_id = ${sak.id} ORDER BY id DESC LIMIT 1`
      );
      return speechInDb;
    }).toBe("t");
  });

  await test.step("participant can add replikk to speaker list", async () => {
    const replikkButton = page.locator('button:has-text("Replikk")');
    await expect(replikkButton).toBeVisible({ timeout: 5000 });
    await replikkButton.click();

    // Verify replikk was added
    await expect.poll(async () => {
      const speechInDb = await query(
        `SELECT s.type FROM roiheimen.speech s WHERE s.sak_id = ${sak.id} AND ended_at IS NULL ORDER BY id DESC LIMIT 1`
      );
      return speechInDb.toUpperCase();
    }).toBe("REPLIKK");
  });
});

test("admin manage.html features", async ({ page, meetingWithSak }) => {
  const { meeting, meetingJwt } = meetingWithSak;

  // JWT already set by fixture, navigate to manage.html
  await page.goto(`/manage.html?id=${meeting.id}`);
  await page.waitForSelector("roi-manage", { timeout: 10000 });

  await test.step("admin can access all tabs in manage.html", async () => {
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    const dialog = page.locator('dialog[open]');

    // 1. "Lag nye saker" tab
    const lagNyeSakerTab = dialog.locator('button[name="sak"]');
    await expect(lagNyeSakerTab).toBeVisible();
    await lagNyeSakerTab.click();
    await expect(dialog.locator('textarea[name="saker"]')).toBeVisible({ timeout: 3000 });

    // 2. "Legg inn kommandoer på sak" tab
    const actionTab = dialog.locator('button[name="action"]');
    await expect(actionTab).toBeVisible();
    await actionTab.click();
    await expect(dialog.locator('textarea[name="adderlines"]')).toBeVisible({ timeout: 3000 });

    // 3. "Statistikk" tab
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

    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 5000 });
  });

  await test.step("admin can create additional sak via Meir dialog", async () => {
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    const dialog = page.locator('dialog[open]');
    await dialog.locator('button[name="sak"]').click();
    await expect(dialog.locator('textarea[name="saker"]')).toBeVisible({ timeout: 3000 });

    await dialog.locator('textarea[name="saker"]').fill('Sak 2: Godkjenning av dagsorden');
    await dialog.locator('input[type="submit"][value="Legg til"]').click();

    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[open]')).not.toBeVisible({ timeout: 5000 });

    // Verify sak was created
    await expect.poll(async () => {
      const sakInDb = await query(
        `SELECT COUNT(*) FROM roiheimen.sak WHERE meeting_id = '${meeting.id}' AND title = 'Sak 2: Godkjenning av dagsorden'`
      );
      return parseInt(sakInDb, 10);
    }).toBeGreaterThan(0);
  });

  await test.step("admin can create invite from Invitasjonar tab", async () => {
    await page.click('button:has-text("Meir")');
    await page.waitForSelector('dialog[open]', { timeout: 5000 });

    const dialog = page.locator('dialog[open]');
    await dialog.locator('button[name="invitasjonar"]').click();
    await dialog.locator('.invitasjonar-tab').waitFor({ timeout: 3000 });

    await page.waitForSelector('roi-invite-generator', { timeout: 5000 });

    const invitesBefore = await query(
      `SELECT COUNT(*) FROM roiheimen.meeting_invite WHERE meeting_id = '${meeting.id}'`
    );

    await page.click('roi-invite-generator button[type="submit"]');
    await page.waitForSelector('.success-card', { timeout: 10000 });

    const successText = await page.textContent('.success-card');
    expect(successText).toContain('Invitasjonskode laga');

    // Verify invite was created
    await expect.poll(async () => {
      const invitesAfter = await query(
        `SELECT COUNT(*) FROM roiheimen.meeting_invite WHERE meeting_id = '${meeting.id}'`
      );
      return parseInt(invitesAfter, 10);
    }).toBeGreaterThan(parseInt(invitesBefore, 10));
  });
});
