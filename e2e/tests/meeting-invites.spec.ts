import { test, expect } from "../fixtures";
import { Page } from "@playwright/test";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Helper to run SQL queries against the test database
 */
async function query(sql: string): Promise<string> {
  const { stdout } = await execAsync(
    `PSQLRC=/dev/null psql -d roiheimen_test -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } }
  );
  const lines = stdout
    .trim()
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("Pager") &&
        !line.startsWith("Expanded") &&
        !line.startsWith("Null")
    );
  return lines[0] || "";
}

/**
 * Helper to generate unique test emails
 */
function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/**
 * Helper to generate unique org slugs
 */
function uniqueSlug(): string {
  return `test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`.toLowerCase();
}

/**
 * Helper to generate unique meeting IDs (max 31 chars)
 */
function uniqueMeetingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `m-${timestamp}-${random}`.toLowerCase();
}

/**
 * Helper to register and verify a user, return their email
 */
async function createVerifiedUser(
  page: Page,
  namePrefix: string = "Test"
): Promise<{ email: string; name: string; password: string }> {
  const email = uniqueEmail();
  const name = `${namePrefix} Brukar`;
  const password = "testpassord123";

  await page.route("**/graphql", async (route, request) => {
    const postData = request.postData() || "";
    if (postData.includes("StartInfo") || postData.includes("currentPerson")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            meetings: { nodes: [] },
            currentPerson: null,
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto("/registrer.html");
  await page.waitForSelector("roi-signup");

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="password2"]', password);

  await page.click('input[type="submit"]');
  await page.waitForSelector(".success", { timeout: 10000 });

  const token = await query(`
    SELECT ev.token FROM roiheimen_private.email_verification ev
    JOIN roiheimen.user_account ua ON ev.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND ev.used_at IS NULL
    ORDER BY ev.created_at DESC LIMIT 1
  `);

  await page.goto(`/stadfest-epost.html?token=${token}`);
  await page.waitForSelector(".success", { timeout: 10000 });

  await page.unroute("**/graphql");

  return { email, name, password };
}

/**
 * Helper to login a user
 */
async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login.html");
  await page.waitForSelector("roi-login");

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  await Promise.all([
    page.waitForURL("**/oversikt.html", { timeout: 10000 }),
    page.click('input[type="submit"]'),
  ]);
}

/**
 * Helper to get user ID from email
 */
async function getUserId(email: string): Promise<number> {
  const result = await query(
    `SELECT id FROM roiheimen.user_account WHERE lower(email) = lower('${email}')`
  );
  return parseInt(result, 10);
}

/**
 * Helper to create organization via GraphQL directly
 */
async function createOrganizationDirect(
  page: Page,
  slug: string,
  name: string
): Promise<{ id: number; slug: string; name: string }> {
  const result = await page.evaluate(
    async ({ slug, name }) => {
      const jwt = JSON.parse(localStorage.getItem("creds") || "{}").jwt;
      if (!jwt) {
        return { error: "No JWT found in localStorage" };
      }
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateOrganization($slug: String!, $name: String!) {
              createOrganization(input: { slug: $slug, name: $name }) {
                organization {
                  id
                  slug
                  name
                }
              }
            }
          `,
          variables: { slug, name },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { slug, name }
  );

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.createOrganization.organization;
}

/**
 * Helper to create meeting via GraphQL
 */
async function createMeetingDirect(
  page: Page,
  orgId: number,
  meetingId: string,
  title: string,
  config: object = {}
): Promise<{ id: string; title: string }> {
  const result = await page.evaluate(
    async ({ orgId, meetingId, title, config }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateOrgMeeting($orgId: Int!, $meetingId: String!, $title: String!, $config: JSON!) {
              createOrgMeeting(input: { orgId: $orgId, meetingId: $meetingId, meetingTitle: $title, meetingConfig: $config }) {
                meeting {
                  id
                  title
                }
              }
            }
          `,
          variables: { orgId, meetingId, title, config },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { orgId, meetingId, title, config }
  );

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.createOrgMeeting.meeting;
}

/**
 * Helper to create invite code via GraphQL
 */
async function createInviteCodeDirect(
  page: Page,
  meetingId: string,
  maxUses: number | null = null,
  expiresAt: string | null = null
): Promise<{ id: number; code: string; maxUses: number | null; expiresAt: string | null }> {
  const result = await page.evaluate(
    async ({ meetingId, maxUses, expiresAt }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateInviteCode($meetingId: String!, $maxUses: Int, $expiresAt: Datetime) {
              createInviteCode(input: { pMeetingId: $meetingId, pMaxUses: $maxUses, pExpiresAt: $expiresAt }) {
                meetingInvite {
                  id
                  code
                  maxUses
                  usesCount
                  expiresAt
                }
              }
            }
          `,
          variables: { meetingId, maxUses, expiresAt },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { meetingId, maxUses, expiresAt }
  );

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.createInviteCode.meetingInvite;
}

/**
 * Helper to validate invite code via GraphQL (mutation - setof function returns array)
 */
async function validateInviteCodeDirect(
  page: Page,
  code: string
): Promise<{ meetingId: string | null; meetingTitle: string | null; orgName: string | null; isValid: boolean }> {
  const result = await page.evaluate(async (code) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No auth required for validation
      },
      body: JSON.stringify({
        query: `
          mutation ValidateInviteCode($code: String!) {
            validateInviteCode(input: { pCode: $code }) {
              inviteValidationResults {
                meetingId
                meetingTitle
                orgName
                isValid
              }
            }
          }
        `,
        variables: { code },
      }),
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${await response.text()}` };
    }
    return response.json();
  }, code);

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  const results = result.data.validateInviteCode?.inviteValidationResults;
  if (!results || results.length === 0) {
    return { meetingId: null, meetingTitle: null, orgName: null, isValid: false };
  }
  return results[0];
}

/**
 * Helper to join meeting via GraphQL
 */
async function joinMeetingDirect(
  page: Page,
  meetingId: string,
  inviteCode: string,
  displayName: string
): Promise<{ id: number; displayName: string; participantNum: number }> {
  const result = await page.evaluate(
    async ({ meetingId, inviteCode, displayName }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation JoinMeeting($meetingId: String!, $inviteCode: String!, $displayName: String!) {
              joinMeeting(input: { pMeetingId: $meetingId, pInviteCode: $inviteCode, pDisplayName: $displayName }) {
                meetingParticipant {
                  id
                  displayName
                  participantNum
                }
              }
            }
          `,
          variables: { meetingId, inviteCode, displayName },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { meetingId, inviteCode, displayName }
  );

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.joinMeeting.meetingParticipant;
}

/**
 * Helper to get meeting token via GraphQL
 * Returns the JWT string which can be decoded to extract claims
 */
async function getMeetingTokenDirect(
  page: Page,
  meetingId: string
): Promise<string> {
  const result = await page.evaluate(async (meetingId) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation GetMeetingToken($meetingId: String!) {
            getMeetingToken(input: { pMeetingId: $meetingId }) {
              jwtToken
            }
          }
        `,
        variables: { meetingId },
      }),
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${await response.text()}` };
    }
    return response.json();
  }, meetingId);

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.getMeetingToken.jwtToken;
}

/**
 * Helper to decode JWT claims (without verification - for testing only)
 */
function decodeJwtClaims(jwt: string): { role: string; person_id: number; meeting_id: string; admin: boolean } {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
  return payload;
}

/**
 * Helper to get meeting invites via GraphQL (mutation - setof function)
 */
async function getMeetingInvitesDirect(
  page: Page,
  meetingId: string
): Promise<Array<{ id: number; code: string; maxUses: number | null; usesCount: number }>> {
  const result = await page.evaluate(async (meetingId) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation GetMeetingInvites($meetingId: String!) {
            getMeetingInvites(input: { pMeetingId: $meetingId }) {
              meetingInvites {
                id
                code
                maxUses
                usesCount
                expiresAt
              }
            }
          }
        `,
        variables: { meetingId },
      }),
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${await response.text()}` };
    }
    return response.json();
  }, meetingId);

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.getMeetingInvites.meetingInvites || [];
}

/**
 * Helper to delete invite code via GraphQL
 */
async function deleteInviteCodeDirect(
  page: Page,
  inviteId: number
): Promise<boolean> {
  const result = await page.evaluate(async (inviteId) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation DeleteInviteCode($inviteId: Int!) {
            deleteInviteCode(input: { pInviteId: $inviteId }) {
              boolean
            }
          }
        `,
        variables: { inviteId },
      }),
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${await response.text()}` };
    }
    return response.json();
  }, inviteId);

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.deleteInviteCode.boolean;
}

/**
 * Helper to get invite from database
 */
async function getInviteFromDb(
  code: string
): Promise<{ id: number; meetingId: string; maxUses: number | null; usesCount: number } | null> {
  const result = await query(
    `SELECT id, meeting_id, max_uses, uses_count FROM roiheimen.meeting_invite WHERE code = '${code}'`
  );
  if (!result) return null;
  const [id, meetingId, maxUses, usesCount] = result.split("|");
  return {
    id: parseInt(id, 10),
    meetingId,
    maxUses: maxUses ? parseInt(maxUses, 10) : null,
    usesCount: parseInt(usesCount, 10),
  };
}

/**
 * Helper to get participant from database
 */
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

test.describe("Meeting Invite Code Generation", () => {
  test("can generate invite code and verify in DB", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite code
    const invite = await createInviteCodeDirect(page, meetingId);

    expect(invite.id).toBeTruthy();
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBe(8);
    expect(invite.maxUses).toBeNull();
    expect(invite.expiresAt).toBeNull();

    // Verify in database
    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();
    expect(dbInvite!.meetingId).toBe(meetingId);
    expect(dbInvite!.usesCount).toBe(0);
  });

  test("can generate invite code with max_uses limit", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite with max 5 uses
    const invite = await createInviteCodeDirect(page, meetingId, 5);

    expect(invite.maxUses).toBe(5);

    // Verify in database
    const dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.maxUses).toBe(5);
  });

  test("can generate invite code with expiry", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite with 24h expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);

    expect(invite.expiresAt).toBeTruthy();
  });

  test("non-admin cannot generate invite code", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create a non-member user
    const nonMember = await createVerifiedUser(page, "NonMember");
    await loginUser(page, nonMember.email, nonMember.password);

    // Try to create invite - should fail
    let error: Error | undefined;
    try {
      await createInviteCodeDirect(page, meetingId);
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/admin or owner/i);
  });
});

test.describe("Join Meeting via Invite Code", () => {
  test("can join meeting via invite code", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite code
    const invite = await createInviteCodeDirect(page, meetingId);

    // Create a participant user
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);

    // Join meeting
    const membership = await joinMeetingDirect(page, meetingId, invite.code, "Ola Nordmann");

    expect(membership.displayName).toBe("Ola Nordmann");
    expect(membership.participantNum).toBe(1);

    // Verify in database
    const userId = await getUserId(participant.email);
    const dbParticipant = await getParticipantFromDb(meetingId, userId);
    expect(dbParticipant).toBeTruthy();
    expect(dbParticipant!.displayName).toBe("Ola Nordmann");
  });

  test("joining increments uses_count", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Check initial count
    let dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.usesCount).toBe(0);

    // Join as participant
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    // Check count incremented
    dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite!.usesCount).toBe(1);
  });

  test("cannot join same meeting twice", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Join as participant
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    // Try to join again - should fail
    let error: Error | undefined;
    try {
      await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/already.*participant/i);
  });
});

test.describe("Invite Code Limits", () => {
  test("invite with max_uses limit enforced", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite with max 1 use
    const invite = await createInviteCodeDirect(page, meetingId, 1);

    // First user joins - should succeed
    const participant1 = await createVerifiedUser(page, "Deltaker1");
    await loginUser(page, participant1.email, participant1.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Deltaker 1");

    // Second user tries to join - should fail
    const participant2 = await createVerifiedUser(page, "Deltaker2");
    await loginUser(page, participant2.email, participant2.password);

    let error: Error | undefined;
    try {
      await joinMeetingDirect(page, meetingId, invite.code, "Deltaker 2");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/maximum uses/i);
  });

  test("expired invite code rejected", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite that already expired (1 second in the past)
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);

    // Try to join with expired code
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);

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

test.describe("Meeting Token", () => {
  test("meeting-scoped JWT grants queue.html access", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Join as participant
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meetingId);
    expect(claims.person_id).toBeGreaterThan(0); // Valid person ID (from bridge)
    expect(claims.admin).toBe(false);
  });

  test("organizer gets admin token", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Owner gets meeting token (they're an org member, so they become organizer)
    const jwt = await getMeetingTokenDirect(page, meetingId);
    const claims = decodeJwtClaims(jwt);

    expect(claims.role).toBe("roiheimen_person");
    expect(claims.meeting_id).toBe(meetingId);
    expect(claims.admin).toBe(true); // Organizers get admin access
  });

  test("non-participant cannot get meeting token", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create a non-member user
    const nonMember = await createVerifiedUser(page, "NonMember");
    await loginUser(page, nonMember.email, nonMember.password);

    // Try to get meeting token - should fail
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

test.describe("Invite Code Validation", () => {
  test("valid invite code returns meeting info", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Validate code (no auth required)
    const validation = await validateInviteCodeDirect(page, invite.code);

    expect(validation.isValid).toBe(true);
    expect(validation.meetingId).toBe(meetingId);
    expect(validation.meetingTitle).toBe("Test Meeting");
    expect(validation.orgName).toBe("Test Org");
  });

  test("invalid invite code returns isValid=false", async ({ page }) => {
    const validation = await validateInviteCodeDirect(page, "INVALID1");

    expect(validation.isValid).toBe(false);
    expect(validation.meetingId).toBeNull();
  });

  test("expired invite code returns isValid=false", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create expired invite
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const invite = await createInviteCodeDirect(page, meetingId, null, expiresAt);

    const validation = await validateInviteCodeDirect(page, invite.code);
    expect(validation.isValid).toBe(false);
  });

  test("exhausted invite code returns isValid=false", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create invite with 1 use
    const invite = await createInviteCodeDirect(page, meetingId, 1);

    // Use it up
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    // Validate - should be exhausted
    const validation = await validateInviteCodeDirect(page, invite.code);
    expect(validation.isValid).toBe(false);
  });
});

test.describe("Invite Management", () => {
  test("can list meeting invites", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Create multiple invites
    const invite1 = await createInviteCodeDirect(page, meetingId);
    const invite2 = await createInviteCodeDirect(page, meetingId, 10);

    // List invites
    const invites = await getMeetingInvitesDirect(page, meetingId);

    expect(invites.length).toBe(2);
    const codes = invites.map((i) => i.code);
    expect(codes).toContain(invite1.code);
    expect(codes).toContain(invite2.code);
  });

  test("can delete invite code", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Verify it exists
    let dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeTruthy();

    // Delete it
    const result = await deleteInviteCodeDirect(page, invite.id);
    expect(result).toBe(true);

    // Verify it's gone
    dbInvite = await getInviteFromDb(invite.code);
    expect(dbInvite).toBeNull();
  });

  test("non-admin cannot delete invite code", async ({ page }) => {
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Login as non-member
    const nonMember = await createVerifiedUser(page, "NonMember");
    await loginUser(page, nonMember.email, nonMember.password);

    // Try to delete - should fail
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

test.describe("Direct Invite Link", () => {
  test.skip("join meeting via direct link /i/{code}", async ({ page }) => {
    // TODO: Requires /i/{code} redirect routing to be implemented
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Create a participant user
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);

    // Navigate to direct link
    await page.goto(`/i/${invite.code}`);

    // Should redirect to bli-med.html with code pre-filled
    await page.waitForURL(`**/bli-med.html?code=${invite.code}`, { timeout: 10000 });

    // The join-meeting component should validate and show meeting info
    await page.waitForSelector("roi-join-meeting", { timeout: 10000 });

    // Wait for meeting info to appear
    await page.waitForSelector(".meeting-info", { timeout: 10000 });

    // Verify meeting info is displayed
    const meetingTitle = await page.textContent(".meeting-info h3");
    expect(meetingTitle).toContain("Test Meeting");
  });
});

test.describe("QR Code", () => {
  test.skip("QR code generates valid link", async ({ page }) => {
    // TODO: Requires manage.html to work with new meeting-scoped JWT system
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Navigate to manage.html and open invite tab
    await page.goto(`/manage.html?id=${meetingId}`);
    await page.waitForSelector("roi-manage", { timeout: 10000 });

    // Click the More button to open dialog
    await page.click('button:has-text("Meir")');
    await page.waitForSelector("#more-dialog", { timeout: 5000 });

    // Click on Invitasjonar tab
    await page.click('button:has-text("Invitasjonar")');

    // Wait for the invite generator component
    await page.waitForSelector("roi-invite-generator", { timeout: 10000 });

    // Create an invite first
    await page.click('roi-invite-generator button[type="submit"]');
    await page.waitForSelector(".success-screen", { timeout: 10000 });

    // Click show QR code button
    await page.click('button:has-text("Vis QR-kode")');

    // Verify QR code component is displayed
    await page.waitForSelector("roi-qr-code canvas", { timeout: 5000 });

    // Verify canvas has content (not empty)
    const canvasHasContent = await page.evaluate(() => {
      const canvas = document.querySelector("roi-qr-code canvas") as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check if there are any non-white pixels
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] < 255 || imageData.data[i + 1] < 255 || imageData.data[i + 2] < 255) {
          return true;
        }
      }
      return false;
    });

    expect(canvasHasContent).toBe(true);
  });
});
