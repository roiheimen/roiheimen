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

import {
  test,
  expect,
  uniqueSlug,
  uniqueMeetingId,
  getUserId,
  getInviteFromDb,
  decodeJwtClaims,
  setJwt,
  createAndLoginUser,
  loginUser,
  GraphQLClient,
  query,
} from "../fixtures";

async function getParticipantFromDb(
  meetingId: string,
  userId: number
): Promise<{ id: number; displayName: string; participantNum: number } | null> {
  const result = await query(
    `SELECT id, display_name, participant_num FROM roiheimen.meeting_participant WHERE meeting_id = '${meetingId}' AND user_id = ${userId}`
  );
  if (!result) return null;
  const [id, displayName, participantNum] = result.split("|");
  return {
    id: parseInt(id, 10),
    displayName,
    participantNum: parseInt(participantNum, 10),
  };
}

// ============================================================================
// Invite Code Generation and Join Flow
// ============================================================================

test("invite code generation and join flow", async ({ meetingAdmin }) => {
  const { api, meeting, user: owner } = meetingAdmin;

  let inviteCode: string;

  await test.step("can generate invite code and verify in DB", async () => {
    const invite = await api.createInviteCode(meeting.id);

    expect(invite.id).toBeTruthy();
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBe(8);
    expect(invite.maxUses).toBeNull();
    expect(invite.expiresAt).toBeNull();

    inviteCode = invite.code;

    // Verify in database
    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();
    expect(dbInvite!.meetingId).toBe(meeting.id);
    expect(dbInvite!.usesCount).toBe(0);
  });

  await test.step("can generate invite code with max_uses limit", async () => {
    const invite = await api.createInviteCode(meeting.id, 5);
    expect(invite.maxUses).toBe(5);

    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.maxUses).toBe(5);
  });

  await test.step("can generate invite code with expiry", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const invite = await api.createInviteCode(meeting.id, null, expiresAt);
    expect(invite.expiresAt).toBeTruthy();
  });
});

test("join meeting via invite code", async ({ page, meetingWithInvite }) => {
  const { meeting, invite, user: owner } = meetingWithInvite;

  await test.step("can join meeting via invite code", async () => {
    const participant = await createAndLoginUser(page, "Deltaker");
    const participantApi = new GraphQLClient(page);

    const membership = await participantApi.joinMeeting(meeting.id, invite.code, "Ola Nordmann");

    expect(membership.displayName).toBe("Ola Nordmann");
    // participantNum is 2 because the meeting owner is automatically participant #1
    expect(membership.participantNum).toBe(2);

    const userId = await getUserId(participant.email);
    const dbParticipant = await getParticipantFromDb(meeting.id, userId);
    expect(dbParticipant).toBeTruthy();
    expect(dbParticipant!.displayName).toBe("Ola Nordmann");
  });

  await test.step("joining increments uses_count", async () => {
    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.usesCount).toBe(1);
  });

  await test.step("cannot join same meeting twice", async () => {
    // participant is still logged in from previous step
    const participantApi = new GraphQLClient(page);

    await expect(
      participantApi.joinMeeting(meeting.id, invite.code, "Test Deltaker")
    ).rejects.toThrow(/already.*participant/i);
  });
});

test("invite code limits", async ({ page, meetingAdmin }) => {
  const { api, org, meeting, user: owner } = meetingAdmin;

  await test.step("invite with max_uses limit enforced", async () => {
    const invite = await api.createInviteCode(meeting.id, 1);

    // First user joins - should succeed
    const participant1 = await createAndLoginUser(page, "Deltaker1");
    const p1Api = new GraphQLClient(page);
    await p1Api.joinMeeting(meeting.id, invite.code, "Deltaker 1");

    // Second user tries - should fail
    const participant2 = await createAndLoginUser(page, "Deltaker2");
    const p2Api = new GraphQLClient(page);

    await expect(
      p2Api.joinMeeting(meeting.id, invite.code, "Deltaker 2")
    ).rejects.toThrow(/maximum uses/i);
  });

  await test.step("expired invite code rejected", async () => {
    await loginUser(page, owner.email, owner.password);

    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const invite = await api.createInviteCode(meeting.id, null, expiresAt);

    const participant = await createAndLoginUser(page, "ExpiredDeltaker");
    const participantApi = new GraphQLClient(page);

    await expect(
      participantApi.joinMeeting(meeting.id, invite.code, "Test Deltaker")
    ).rejects.toThrow(/expired/i);
  });
});

test("non-admin cannot generate invite code", async ({ page, meetingAdmin }) => {
  const { meeting } = meetingAdmin;

  const nonMember = await createAndLoginUser(page, "NonMember");
  const nonMemberApi = new GraphQLClient(page);

  await expect(nonMemberApi.createInviteCode(meeting.id)).rejects.toThrow(/admin or owner/i);
});

// ============================================================================
// Meeting Token
// ============================================================================

test("meeting token", async ({ page, meetingWithInvite }) => {
  const { api, meeting, invite, user: owner } = meetingWithInvite;

  await test.step("meeting-scoped JWT grants queue.html access", async () => {
    const participant = await createAndLoginUser(page, "Deltaker");
    const participantApi = new GraphQLClient(page);
    await participantApi.joinMeeting(meeting.id, invite.code, "Test Deltaker");

    const jwt = await participantApi.getMeetingToken(meeting.id);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meeting.id);
    expect(claims.person_id).toBeGreaterThan(0);
    expect(claims.admin).toBe(false);
  });

  await test.step("organizer gets admin token", async () => {
    await loginUser(page, owner.email, owner.password);

    const jwt = await api.getMeetingToken(meeting.id);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meeting.id);
    expect(claims.admin).toBe(true);
  });

  await test.step("non-participant cannot get meeting token", async () => {
    const nonMember = await createAndLoginUser(page, "NonMember");
    const nonMemberApi = new GraphQLClient(page);

    await expect(nonMemberApi.getMeetingToken(meeting.id)).rejects.toThrow(/not a participant/i);
  });
});

// ============================================================================
// Invite Code Validation
// ============================================================================

test("invite code validation", async ({ page, meetingWithInvite }) => {
  const { api, meeting, invite, user: owner } = meetingWithInvite;

  await test.step("valid invite code returns meeting info", async () => {
    const validation = await api.validateInviteCode(invite.code);

    expect(validation.isValid).toBe(true);
    expect(validation.meetingId).toBe(meeting.id);
    expect(validation.meetingTitle).toBe("Test Meeting");
  });

  await test.step("invalid invite code returns isValid=false", async () => {
    const validation = await api.validateInviteCode("INVALID1");
    expect(validation.isValid).toBe(false);
    expect(validation.meetingId).toBeNull();
  });

  await test.step("expired invite code returns isValid=false", async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const expiredInvite = await api.createInviteCode(meeting.id, null, expiresAt);

    const validation = await api.validateInviteCode(expiredInvite.code);
    expect(validation.isValid).toBe(false);
  });

  await test.step("exhausted invite code returns isValid=false", async () => {
    const limitedInvite = await api.createInviteCode(meeting.id, 1);

    // Use it up
    const participant = await createAndLoginUser(page, "Deltaker");
    const participantApi = new GraphQLClient(page);
    await participantApi.joinMeeting(meeting.id, limitedInvite.code, "Test Deltaker");

    // Re-login as owner to validate
    await loginUser(page, owner.email, owner.password);
    const validation = await api.validateInviteCode(limitedInvite.code);
    expect(validation.isValid).toBe(false);
  });
});

// ============================================================================
// Invite Management
// ============================================================================

test("invite management", async ({ page, meetingAdmin }) => {
  const { api, meeting, user: owner } = meetingAdmin;

  await test.step("can list meeting invites", async () => {
    const invite1 = await api.createInviteCode(meeting.id);
    const invite2 = await api.createInviteCode(meeting.id, 10);

    const invites = await api.getMeetingInvites(meeting.id);

    expect(invites.length).toBe(2);
    const codes = invites.map((i) => i.code);
    expect(codes).toContain(invite1.code);
    expect(codes).toContain(invite2.code);
  });

  await test.step("can delete invite code", async () => {
    const invite = await api.createInviteCode(meeting.id);

    let dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();

    const result = await api.deleteInviteCode(invite.id);
    expect(result).toBe(true);

    dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeNull();
  });

  await test.step("non-admin cannot delete invite code", async () => {
    const invite = await api.createInviteCode(meeting.id);

    const nonMember = await createAndLoginUser(page, "NonMember");
    const nonMemberApi = new GraphQLClient(page);

    await expect(nonMemberApi.deleteInviteCode(invite.id)).rejects.toThrow(/admin or owner/i);
  });
});

// ============================================================================
// Direct Link and QR Code
// ============================================================================

test("direct invite link", async ({ page, meetingWithInvite }) => {
  const { meeting, invite, user: owner } = meetingWithInvite;

  // Create participant
  const participant = await createAndLoginUser(page, "Deltaker");

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

test("QR code display", async ({ page, meetingWithSak }) => {
  const { meeting, meetingJwt } = meetingWithSak;

  // Navigate to manage.html (JWT already set by fixture)
  await page.goto(`/manage.html?id=${meeting.id}`);
  await page.waitForSelector("roi-manage", { timeout: 10000 });

  // Open dialog and go to Invitasjonar tab
  await page.click('button:has-text("Meir")');
  await page.waitForSelector('dialog[open]', { timeout: 5000 });
  await page.click('button[name="invitasjonar"]');

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
