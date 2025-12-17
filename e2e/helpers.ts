/**
 * Shared helper functions for E2E tests
 *
 * This module provides reusable utilities for:
 * - Database queries
 * - Unique ID generation
 * - User management (registration, login, verification)
 * - GraphQL API interactions
 * - Organization and meeting management
 */

import { Page } from "@playwright/test";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Run SQL query against the test database
 */
export async function query(sql: string): Promise<string> {
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
 * Run SQL query that returns multiple rows
 */
export async function queryRows(sql: string): Promise<string[]> {
  const { stdout } = await execAsync(
    `PSQLRC=/dev/null psql -d roiheimen_test -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } }
  );
  return stdout
    .trim()
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("Pager") &&
        !line.startsWith("Expanded") &&
        !line.startsWith("Null")
    );
}

// ============================================================================
// Unique ID Generators
// ============================================================================

/**
 * Generate unique test email
 */
export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/**
 * Generate unique organization slug
 */
export function uniqueSlug(): string {
  return `test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`.toLowerCase();
}

/**
 * Generate unique meeting ID (max 31 chars)
 */
export function uniqueMeetingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `m-${timestamp}-${random}`.toLowerCase();
}

// ============================================================================
// User Management - UI Based (for testing full flows)
// ============================================================================

/**
 * Register a user via the UI (for testing registration flow)
 */
export async function registerUser(
  page: Page,
  name: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/registrer.html");
  await page.waitForSelector("roi-signup");

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="password2"]', password);

  await page.click('input[type="submit"]');
  await page.waitForSelector(".success", { timeout: 10000 });
}

/**
 * Create a verified user via UI (full flow - use for UI testing)
 */
export async function createVerifiedUser(
  page: Page,
  namePrefix: string = "Test"
): Promise<{ email: string; name: string; password: string }> {
  const email = uniqueEmail();
  const name = `${namePrefix} Brukar`;
  const password = "testpassord123";

  // Route interception to prevent legacy auth system errors
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

  // Register via UI
  await page.goto("/registrer.html");
  await page.waitForSelector("roi-signup");

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="password2"]', password);

  await page.click('input[type="submit"]');
  await page.waitForSelector(".success", { timeout: 10000 });

  // Get verification token and verify email via UI
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
 * Create a verified user fast (API + DB bypass - use for setup, not UI testing)
 */
export async function createVerifiedUserFast(
  page: Page,
  namePrefix: string = "Test"
): Promise<{ email: string; name: string; password: string }> {
  const email = uniqueEmail();
  const name = `${namePrefix} Brukar`;
  const password = "testpassord123";

  // Ensure we're on a page (needed for fetch to work from browser context)
  const currentUrl = page.url();
  if (currentUrl === "about:blank" || !currentUrl.startsWith("http")) {
    await page.goto("/");
  }

  // Register via GraphQL API directly (no browser navigation)
  const result = await page.evaluate(
    async ({ email, password, name }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Register($email: String!, $password: String!, $name: String!) {
            registerUser(input: { email: $email, password: $password, name: $name }) {
              registerUserResult { userId }
            }
          }`,
          variables: { email, password, name },
        }),
      });
      return response.json();
    },
    { email, password, name }
  );

  if (result.errors) {
    throw new Error(`Registration failed: ${result.errors[0].message}`);
  }

  // Verify email directly via DB (skip email verification page)
  await query(`
    UPDATE roiheimen_private.user_credentials uc
    SET email_verified = true
    FROM roiheimen.user_account ua
    WHERE uc.user_id = ua.id AND lower(ua.email) = lower('${email}')
  `);

  return { email, name, password };
}

/**
 * Login a user via the UI
 */
export async function loginUser(
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
 * Login a user via API (faster, for setup)
 */
export async function loginUserFast(
  page: Page,
  email: string,
  password: string
): Promise<string> {
  const result = await page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Login($email: String!, $password: String!) {
            authenticateUser(input: { email: $email, password: $password }) {
              jwtToken
            }
          }`,
          variables: { email, password },
        }),
      });
      return response.json();
    },
    { email, password }
  );

  if (result.errors) {
    throw new Error(`Login failed: ${result.errors[0].message}`);
  }

  const jwt = result.data.authenticateUser.jwtToken;

  // Store JWT in localStorage
  await page.evaluate((jwt) => {
    localStorage.setItem("creds", JSON.stringify({ jwt }));
  }, jwt);

  return jwt;
}

/**
 * Create a sak (agenda item) via GraphQL
 */
export async function createSakDirect(
  page: Page,
  meetingId: string,
  title: string
): Promise<{ id: number; title: string }> {
  const result = await page.evaluate(
    async ({ meetingId, title }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateSak($meetingId: String!, $title: String!) {
              createSak(input: { sak: { meetingId: $meetingId, title: $title, config: {} } }) {
                sak { id title }
              }
            }
          `,
          variables: { meetingId, title },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { meetingId, title }
  );

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.createSak.sak;
}

// ============================================================================
// User Database Helpers
// ============================================================================

/**
 * Get user ID from email
 */
export async function getUserId(email: string): Promise<number> {
  const result = await query(
    `SELECT id FROM roiheimen.user_account WHERE lower(email) = lower('${email}')`
  );
  return parseInt(result, 10);
}

/**
 * Get verification token from database
 */
export async function getVerificationToken(email: string): Promise<string | null> {
  const result = await query(`
    SELECT ev.token FROM roiheimen_private.email_verification ev
    JOIN roiheimen.user_account ua ON ev.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND ev.used_at IS NULL
    ORDER BY ev.created_at DESC LIMIT 1
  `);
  return result || null;
}

/**
 * Get password reset token from database
 */
export async function getPasswordResetToken(email: string): Promise<string | null> {
  const result = await query(`
    SELECT pr.token FROM roiheimen_private.password_reset pr
    JOIN roiheimen.user_account ua ON pr.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND pr.used_at IS NULL
    ORDER BY pr.created_at DESC LIMIT 1
  `);
  return result || null;
}

/**
 * Check if email is verified
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const result = await query(`
    SELECT uc.email_verified FROM roiheimen_private.user_credentials uc
    JOIN roiheimen.user_account ua ON uc.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
  `);
  return result === "t";
}

/**
 * Get failed login attempts for a user
 */
export async function getFailedAttempts(email: string): Promise<number> {
  const result = await query(`
    SELECT uc.failed_attempts FROM roiheimen_private.user_credentials uc
    JOIN roiheimen.user_account ua ON uc.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
  `);
  return parseInt(result || "0", 10);
}

// ============================================================================
// Organization Helpers
// ============================================================================

/**
 * Create organization via GraphQL
 */
export async function createOrganizationDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.createOrganization.organization;
}

/**
 * Update organization via GraphQL
 */
export async function updateOrganizationDirect(
  page: Page,
  orgId: number,
  newName: string | null,
  newConfig: object | null = null
): Promise<{ id: number; name: string }> {
  const result = await page.evaluate(
    async ({ orgId, newName, newConfig }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation UpdateOrganization($orgId: Int!, $newName: String, $newConfig: JSON) {
              updateOrganization(input: { orgId: $orgId, newName: $newName, newConfig: $newConfig }) {
                organization {
                  id
                  name
                  config
                }
              }
            }
          `,
          variables: { orgId, newName, newConfig },
        }),
      });
      return response.json();
    },
    { orgId, newName, newConfig }
  );

  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.updateOrganization.organization;
}

/**
 * Invite to organization via GraphQL
 */
export async function inviteToOrganizationDirect(
  page: Page,
  orgId: number,
  email: string,
  role: string = "MEMBER"
): Promise<{ token: string }> {
  const result = await page.evaluate(
    async ({ orgId, email, role }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation InviteToOrganization($orgId: Int!, $email: String!, $role: OrganizationRole!) {
              inviteToOrganization(input: { orgId: $orgId, inviteEmail: $email, inviteRole: $role }) {
                organizationInvite {
                  token
                }
              }
            }
          `,
          variables: { orgId, email, role },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { orgId, email, role }
  );

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return { token: result.data.inviteToOrganization.organizationInvite.token };
}

/**
 * Accept organization invite via GraphQL
 */
export async function acceptOrganizationInviteDirect(
  page: Page,
  token: string
): Promise<{ userId: number; role: string }> {
  const result = await page.evaluate(async (token) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation AcceptOrganizationInvite($token: String!) {
            acceptOrganizationInvite(input: { inviteToken: $token }) {
              organizationMember {
                userId
                role
              }
            }
          }
        `,
        variables: { token },
      }),
    });
    return response.json();
  }, token);

  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.acceptOrganizationInvite.organizationMember;
}

/**
 * Remove organization member via GraphQL
 */
export async function removeOrganizationMemberDirect(
  page: Page,
  orgId: number,
  userId: number
): Promise<boolean> {
  const result = await page.evaluate(
    async ({ orgId, userId }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation RemoveOrganizationMember($orgId: Int!, $userId: Int!) {
              removeOrganizationMember(input: { orgId: $orgId, memberUserId: $userId }) {
                boolean
              }
            }
          `,
          variables: { orgId, userId },
        }),
      });
      return response.json();
    },
    { orgId, userId }
  );

  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.removeOrganizationMember.boolean;
}

/**
 * Get my organizations via GraphQL
 */
export async function getMyOrganizations(
  page: Page
): Promise<Array<{ id: number; slug: string; name: string }>> {
  const result = await page.evaluate(async () => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          query MyOrganizations {
            myOrganizations {
              nodes {
                id
                slug
                name
              }
            }
          }
        `,
      }),
    });
    return response.json();
  });

  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.myOrganizations.nodes;
}

// Organization database helpers

export async function getOrganization(
  slug: string
): Promise<{ id: number; name: string; slug: string } | null> {
  const result = await query(
    `SELECT id, name, slug FROM roiheimen.organization WHERE slug = '${slug}'`
  );
  if (!result) return null;
  const [id, name, slug_] = result.split("|");
  return { id: parseInt(id, 10), name, slug: slug_ };
}

export async function getOrganizationMember(
  orgId: number,
  userId: number
): Promise<{ role: string } | null> {
  const result = await query(
    `SELECT role FROM roiheimen.organization_member WHERE organization_id = ${orgId} AND user_id = ${userId}`
  );
  if (!result) return null;
  return { role: result };
}

export async function getOrganizationInvite(
  orgId: number,
  email: string
): Promise<{ token: string; role: string } | null> {
  const result = await query(
    `SELECT token, role FROM roiheimen.organization_invite WHERE organization_id = ${orgId} AND lower(email) = lower('${email}') AND accepted_at IS NULL`
  );
  if (!result) return null;
  const [token, role] = result.split("|");
  return { token, role };
}

// ============================================================================
// Meeting Helpers
// ============================================================================

/**
 * Create meeting via GraphQL
 */
export async function createMeetingDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.createOrgMeeting.meeting;
}

/**
 * Update meeting via GraphQL
 */
export async function updateMeetingDirect(
  page: Page,
  meetingId: string,
  newTitle: string | null,
  newConfig: object | null = null
): Promise<{ id: string; title: string }> {
  const result = await page.evaluate(
    async ({ meetingId, newTitle, newConfig }) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `
            mutation UpdateOrgMeeting($meetingId: String!, $newTitle: String, $newConfig: JSON) {
              updateOrgMeeting(input: { meetingId: $meetingId, newTitle: $newTitle, newConfig: $newConfig }) {
                meeting {
                  id
                  title
                  config
                }
              }
            }
          `,
          variables: { meetingId, newTitle, newConfig },
        }),
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return response.json();
    },
    { meetingId, newTitle, newConfig }
  );

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.updateOrgMeeting.meeting;
}

/**
 * Delete meeting via GraphQL
 */
export async function deleteMeetingDirect(page: Page, meetingId: string): Promise<boolean> {
  const result = await page.evaluate(async (meetingId) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation DeleteOrgMeeting($meetingId: String!) {
            deleteOrgMeeting(input: { meetingId: $meetingId }) {
              boolean
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.deleteOrgMeeting.boolean;
}

// Meeting database helpers

export async function getMeeting(
  meetingId: string
): Promise<{ id: string; title: string; organizationId: number } | null> {
  const result = await query(
    `SELECT id, title, organization_id FROM roiheimen.meeting WHERE id = '${meetingId}'`
  );
  if (!result) return null;
  const [id, title, orgId] = result.split("|");
  return { id, title, organizationId: parseInt(orgId, 10) };
}

// ============================================================================
// Invite Helpers
// ============================================================================

/**
 * Create invite code via GraphQL
 */
export async function createInviteCodeDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.createInviteCode.meetingInvite;
}

/**
 * Validate invite code via GraphQL
 */
export async function validateInviteCodeDirect(
  page: Page,
  code: string
): Promise<{ meetingId: string | null; meetingTitle: string | null; orgName: string | null; isValid: boolean }> {
  const result = await page.evaluate(async (code) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);

  const results = result.data.validateInviteCode?.inviteValidationResults;
  if (!results || results.length === 0) {
    return { meetingId: null, meetingTitle: null, orgName: null, isValid: false };
  }
  return results[0];
}

/**
 * Join meeting via GraphQL
 */
export async function joinMeetingDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.joinMeeting.meetingParticipant;
}

/**
 * Get meeting token via GraphQL
 */
export async function getMeetingTokenDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.getMeetingToken.jwtToken;
}

/**
 * Get meeting invites via GraphQL
 */
export async function getMeetingInvitesDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.getMeetingInvites.meetingInvites || [];
}

/**
 * Delete invite code via GraphQL
 */
export async function deleteInviteCodeDirect(
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

  if (result.error) throw new Error(result.error);
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.deleteInviteCode.boolean;
}

// Invite database helpers

export async function getInviteFromDb(
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

export async function getParticipantFromDb(
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
// JWT Helpers
// ============================================================================

/**
 * Decode JWT claims (without verification - for testing only)
 */
export function decodeJwtClaims(jwt: string): {
  role: string;
  person_id: number;
  meeting_id: string;
  admin: boolean;
} {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
  return payload;
}

/**
 * Set meeting JWT in localStorage (for accessing meeting pages)
 */
export async function setMeetingJwt(page: Page, jwt: string): Promise<void> {
  await page.evaluate((jwt) => {
    localStorage.setItem("creds", JSON.stringify({ jwt }));
  }, jwt);
}
