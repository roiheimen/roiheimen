/**
 * Meeting Invites Tests
 *
 * Tests meeting invite system:
 * - Invite code generation
 * - Join meeting via invite
 * - Invite limits and expiry
 * - Meeting tokens
 * - Invite validation and management
 * - Direct links and QR codes
 */

import { test, expect } from "../fixtures";
import {
  uniqueSlug,
  uniqueMeetingId,
  createVerifiedUserFast,
  loginUserFast,
  getUserId,
  // Organization helpers
  createOrganizationDirect,
  // Meeting helpers
  createMeetingDirect,
  // Invite helpers
  createInviteCodeDirect,
  validateInviteCodeDirect,
  joinMeetingDirect,
  getMeetingTokenDirect,
  getMeetingInvitesDirect,
  deleteInviteCodeDirect,
  getInviteFromDb,
  getParticipantFromDb,
  decodeJwtClaims,
  setMeetingJwt,
} from "../helpers";

// ============================================================================
// Invite Code Generation and Join Flow
// ============================================================================

test("invite code generation and join flow", async ({ page }) => {
  // Setup: owner, org, meeting
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  let inviteCode: string;

  await test.step("can generate invite code and verify in DB", async () => {
    const invite = await createInviteCodeDirect(page, meetingId);

    expect(invite.id).toBeTruthy();
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBe(8);
    expect(invite.maxUses).toBeNull();
    expect(invite.expiresAt).toBeNull();

    inviteCode = invite.code;

    // Verify in database
    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();
    expect(dbInvite!.meetingId).toBe(meetingId);
    expect(dbInvite!.usesCount).toBe(0);
  });

  await test.step("can generate invite code with max_uses limit", async () => {
    const invite = await createInviteCodeDirect(page, meetingId, 5);
    expect(invite.maxUses).toBe(5);

    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.maxUses).toBe(5);
  });

  await test.step("can generate invite code with expiry", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);
    expect(invite.expiresAt).toBeTruthy();
  });

  await test.step("can join meeting via invite code", async () => {
    const participant = await createVerifiedUserFast(page, "Deltaker");
    await loginUserFast(page, participant.email, participant.password);

    const membership = await joinMeetingDirect(page, meetingId, inviteCode, "Ola Nordmann");

    expect(membership.displayName).toBe("Ola Nordmann");
    expect(membership.participantNum).toBe(1);

    const userId = await getUserId(participant.email);
    const dbParticipant = await getParticipantFromDb(meetingId, userId);
    expect(dbParticipant).toBeTruthy();
    expect(dbParticipant!.displayName).toBe("Ola Nordmann");
  });

  await test.step("joining increments uses_count", async () => {
    const dbInvite = await getInviteFromDb(inviteCode);
    expect(dbInvite!.usesCount).toBe(1);
  });

  await test.step("cannot join same meeting twice", async () => {
    // Try to join again with same user (still logged in as participant)
    let error: Error | undefined;
    try {
      await joinMeetingDirect(page, meetingId, inviteCode, "Test Deltaker");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/already.*participant/i);
  });
});

test("invite code limits", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  await test.step("invite with max_uses limit enforced", async () => {
    const invite = await createInviteCodeDirect(page, meetingId, 1);

    // First user joins - should succeed
    const participant1 = await createVerifiedUserFast(page, "Deltaker1");
    await loginUserFast(page, participant1.email, participant1.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Deltaker 1");

    // Second user tries - should fail
    const participant2 = await createVerifiedUserFast(page, "Deltaker2");
    await loginUserFast(page, participant2.email, participant2.password);

    let error: Error | undefined;
    try {
      await joinMeetingDirect(page, meetingId, invite.code, "Deltaker 2");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/maximum uses/i);
  });

  await test.step("expired invite code rejected", async () => {
    await loginUserFast(page, owner.email, owner.password);

    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);

    const participant = await createVerifiedUserFast(page, "ExpiredDeltaker");
    await loginUserFast(page, participant.email, participant.password);

    let error: Error | undefined;
    try {
      await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/expired/i);
  });
});

test("non-admin cannot generate invite code", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  const nonMember = await createVerifiedUserFast(page, "NonMember");
  await loginUserFast(page, nonMember.email, nonMember.password);

  let error: Error | undefined;
  try {
    await createInviteCodeDirect(page, meetingId);
  } catch (e) {
    error = e as Error;
  }
  expect(error).toBeDefined();
  expect(error?.message).toMatch(/admin or owner/i);
});

// ============================================================================
// Meeting Token
// ============================================================================

test("meeting token", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  const invite = await createInviteCodeDirect(page, meetingId);

  await test.step("meeting-scoped JWT grants queue.html access", async () => {
    const participant = await createVerifiedUserFast(page, "Deltaker");
    await loginUserFast(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    const jwt = await getMeetingTokenDirect(page, meetingId);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meetingId);
    expect(claims.person_id).toBeGreaterThan(0);
    expect(claims.admin).toBe(false);
  });

  await test.step("organizer gets admin token", async () => {
    await loginUserFast(page, owner.email, owner.password);

    const jwt = await getMeetingTokenDirect(page, meetingId);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meetingId);
    expect(claims.admin).toBe(true);
  });

  await test.step("non-participant cannot get meeting token", async () => {
    const nonMember = await createVerifiedUserFast(page, "NonMember");
    await loginUserFast(page, nonMember.email, nonMember.password);

    let error: Error | undefined;
    try {
      await getMeetingTokenDirect(page, meetingId);
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/not a participant/i);
  });
});

// ============================================================================
// Invite Code Validation
// ============================================================================

test("invite code validation", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  await test.step("valid invite code returns meeting info", async () => {
    const invite = await createInviteCodeDirect(page, meetingId);
    const validation = await validateInviteCodeDirect(page, invite.code);

    expect(validation.isValid).toBe(true);
    expect(validation.meetingId).toBe(meetingId);
    expect(validation.meetingTitle).toBe("Test Meeting");
    expect(validation.orgName).toBe("Test Org");
  });

  await test.step("invalid invite code returns isValid=false", async () => {
    const validation = await validateInviteCodeDirect(page, "INVALID1");
    expect(validation.isValid).toBe(false);
    expect(validation.meetingId).toBeNull();
  });

  await test.step("expired invite code returns isValid=false", async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);

    const validation = await validateInviteCodeDirect(page, invite.code);
    expect(validation.isValid).toBe(false);
  });

  await test.step("exhausted invite code returns isValid=false", async () => {
    const invite = await createInviteCodeDirect(page, meetingId, 1);

    // Use it up
    const participant = await createVerifiedUserFast(page, "Deltaker");
    await loginUserFast(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    const validation = await validateInviteCodeDirect(page, invite.code);
    expect(validation.isValid).toBe(false);
  });
});

// ============================================================================
// Invite Management
// ============================================================================

test("invite management", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  await test.step("can list meeting invites", async () => {
    const invite1 = await createInviteCodeDirect(page, meetingId);
    const invite2 = await createInviteCodeDirect(page, meetingId, 10);

    const invites = await getMeetingInvitesDirect(page, meetingId);

    expect(invites.length).toBe(2);
    const codes = invites.map((i) => i.code);
    expect(codes).toContain(invite1.code);
    expect(codes).toContain(invite2.code);
  });

  await test.step("can delete invite code", async () => {
    const invite = await createInviteCodeDirect(page, meetingId);

    let dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();

    const result = await deleteInviteCodeDirect(page, invite.id);
    expect(result).toBe(true);

    dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeNull();
  });

  await test.step("non-admin cannot delete invite code", async () => {
    const invite = await createInviteCodeDirect(page, meetingId);

    const nonMember = await createVerifiedUserFast(page, "NonMember");
    await loginUserFast(page, nonMember.email, nonMember.password);

    let error: Error | undefined;
    try {
      await deleteInviteCodeDirect(page, invite.id);
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/admin or owner/i);
  });
});

// ============================================================================
// Direct Link and QR Code
// ============================================================================

test("direct invite link", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  const invite = await createInviteCodeDirect(page, meetingId);

  // Create participant
  const participant = await createVerifiedUserFast(page, "Deltaker");
  await loginUserFast(page, participant.email, participant.password);

  // Navigate to direct link
  await page.goto(`/i/${invite.code}`);

  // Should redirect to bli-med.html
  const url = page.url();
  expect(url).toContain("bli-med.html");
  expect(url).toContain(`code=${invite.code}`);

  // Should show meeting info
  await page.waitForSelector("roi-join-meeting", { timeout: 10000 });
  await page.waitForSelector(".meeting-info", { timeout: 10000 });

  const meetingTitle = await page.textContent(".meeting-info h3");
  expect(meetingTitle).toContain("Test Meeting");
});

test("QR code display", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  // Get meeting token for manage.html
  const meetingJwt = await getMeetingTokenDirect(page, meetingId);
  await setMeetingJwt(page, meetingJwt);

  // Navigate to manage.html
  await page.goto(`/manage.html?id=${meetingId}`);
  await page.waitForSelector("roi-manage", { timeout: 10000 });

  // Create a sak first (needed for "Meir" button)
  await page.click('button:has-text("Ny sak")');
  await page.waitForSelector("dialog[open]", { timeout: 5000 });
  await page.fill('input[name="title"]', "Test Sak");
  await page.click('input[type="submit"][value="Legg til og bytt"]');
  await page.waitForSelector('button:has-text("Meir")', { timeout: 10000 });

  // Open dialog and go to Invitasjonar tab
  await page.click('button:has-text("Meir")');
  await page.waitForSelector('dialog[open]:has-text("Administrer saker")', { timeout: 5000 });
  await page.click('button:has-text("Invitasjonar")');

  await page.waitForSelector("roi-invite-generator", { timeout: 10000 });

  // Create invite
  await page.click('roi-invite-generator button[type="submit"]');
  await page.waitForSelector(".success-card", { timeout: 10000 });

  // Show QR code
  await page.click('button:has-text("Vis QR-kode")');
  await page.waitForSelector("roi-qr-code canvas", { timeout: 5000 });

  // Verify canvas has content
  const canvasHasContent = await page.evaluate(() => {
    const canvas = document.querySelector("roi-qr-code canvas") as HTMLCanvasElement;
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 255 || imageData.data[i + 1] < 255 || imageData.data[i + 2] < 255) {
        return true;
      }
    }
    return false;
  });

  expect(canvasHasContent).toBe(true);
});
