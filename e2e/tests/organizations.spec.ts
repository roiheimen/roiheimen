/**
 * Organization & Meeting Tests
 *
 * Tests organization and meeting management:
 * - Organization CRUD
 * - Organization invites and members
 * - Meeting CRUD
 * - RLS policies
 * - Dashboard and navigation
 *
 * Uses fast user creation for setup where UI testing isn't needed.
 */

import { test, expect } from "../fixtures";
import {
  uniqueEmail,
  uniqueSlug,
  uniqueMeetingId,
  createVerifiedUser,
  createVerifiedUserFast,
  loginUser,
  loginUserFast,
  getUserId,
  query,
  // Organization helpers
  createOrganizationDirect,
  updateOrganizationDirect,
  inviteToOrganizationDirect,
  acceptOrganizationInviteDirect,
  removeOrganizationMemberDirect,
  getMyOrganizations,
  getOrganization,
  getOrganizationMember,
  // Meeting helpers
  createMeetingDirect,
  updateMeetingDirect,
  deleteMeetingDirect,
  getMeeting,
} from "../helpers";

// ============================================================================
// Organization Management Flow
// ============================================================================

test("organization management flow", async ({ page }) => {
  // Arrange: Create and login as owner
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  let org: { id: number; slug: string; name: string };
  const slug = uniqueSlug();

  await test.step("can create organization and verify owner membership", async () => {
    org = await createOrganizationDirect(page, slug, "Test Organisasjon");

    expect(org.slug).toBe(slug);
    expect(org.name).toBe("Test Organisasjon");

    // Verify in database
    const dbOrg = await getOrganization(slug);
    expect(dbOrg).toBeTruthy();
    expect(dbOrg!.name).toBe("Test Organisasjon");

    // Verify user is owner
    const userId = await getUserId(owner.email);
    const member = await getOrganizationMember(dbOrg!.id, userId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("owner");
  });

  await test.step("can update organization name", async () => {
    const updated = await updateOrganizationDirect(page, org.id, "Nytt Namn");
    expect(updated.name).toBe("Nytt Namn");

    const dbOrg = await getOrganization(slug);
    expect(dbOrg!.name).toBe("Nytt Namn");
  });

  await test.step("can update organization config", async () => {
    const config = { theme: "dark", feature: true };
    await updateOrganizationDirect(page, org.id, null, config);

    const dbConfig = await query(
      `SELECT config FROM roiheimen.organization WHERE slug = '${slug}'`
    );
    expect(dbConfig).toContain("dark");
  });
});

test("organization slug validation", async ({ page }) => {
  const user = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, user.email, user.password);

  const existingSlug = uniqueSlug();
  await createOrganizationDirect(page, existingSlug, "First Org");

  await test.step("slug must be unique", async () => {
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, existingSlug, "Second Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
  });

  await test.step("rejects invalid characters", async () => {
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, "test@org", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");
  });

  await test.step("rejects too short slug", async () => {
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, "a", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");
  });

  await test.step("rejects slug with spaces", async () => {
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, "invalid slug", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");
  });
});

// ============================================================================
// Organization Invites and Members
// ============================================================================

test("organization invite and member flow", async ({ page }) => {
  // Setup owner and organization
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");

  // Create invitee
  const invitee = await createVerifiedUserFast(page, "Invitee");

  await test.step("can invite member by email and verify pending invite", async () => {
    // Re-login as owner
    await loginUserFast(page, owner.email, owner.password);

    const invite = await inviteToOrganizationDirect(page, org.id, invitee.email, "MEMBER");
    expect(invite.token).toBeTruthy();
  });

  await test.step("invited user can accept invite and join organization", async () => {
    // Get the invite token from DB
    const dbInvite = await query(
      `SELECT token FROM roiheimen.organization_invite WHERE organization_id = ${org.id} AND lower(email) = lower('${invitee.email}') AND accepted_at IS NULL`
    );
    expect(dbInvite).toBeTruthy();

    // Login as invitee and accept
    await loginUserFast(page, invitee.email, invitee.password);
    const membership = await acceptOrganizationInviteDirect(page, dbInvite);

    expect(membership.role).toBe("MEMBER");

    // Verify in database
    const inviteeUserId = await getUserId(invitee.email);
    const member = await getOrganizationMember(org.id, inviteeUserId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("member");
  });

  await test.step("member can see organization in their list", async () => {
    const orgs = await getMyOrganizations(page);
    const foundOrg = orgs.find((o) => o.slug === slug);
    expect(foundOrg).toBeTruthy();
    expect(foundOrg!.name).toBe("Test Org");
  });

  await test.step("owner can remove member and verify access revoked", async () => {
    // Login as owner
    await loginUserFast(page, owner.email, owner.password);

    const memberUserId = await getUserId(invitee.email);
    await removeOrganizationMemberDirect(page, org.id, memberUserId);

    // Verify in database
    const dbMember = await getOrganizationMember(org.id, memberUserId);
    expect(dbMember).toBeNull();

    // Login as ex-member and verify no access
    await loginUserFast(page, invitee.email, invitee.password);
    const orgs = await getMyOrganizations(page);
    expect(orgs.find((o) => o.slug === slug)).toBeUndefined();
  });
});

// ============================================================================
// RLS Policies
// ============================================================================

test("organization RLS policies", async ({ page }) => {
  // Create owner and organization
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Private Org");

  // Create non-member
  const nonMember = await createVerifiedUserFast(page, "NonMember");

  await test.step("non-member cannot see organization data", async () => {
    await loginUserFast(page, nonMember.email, nonMember.password);

    const orgs = await getMyOrganizations(page);
    const foundOrg = orgs.find((o) => o.slug === slug);
    expect(foundOrg).toBeUndefined();
  });

  await test.step("member cannot edit organization (only admin/owner)", async () => {
    // Create and invite a member
    const member = await createVerifiedUserFast(page, "Member");
    await loginUserFast(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(page, org.id, member.email, "MEMBER");

    // Accept invite as member
    await loginUserFast(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    // Try to update - should fail
    let error: Error | undefined;
    try {
      await updateOrganizationDirect(page, org.id, "Hacked Name");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/admin or owner/);
  });
});

// ============================================================================
// Organization UI
// ============================================================================

test("organization creation UI", async ({ page }) => {
  const user = await createVerifiedUser(page, "Owner");
  await loginUser(page, user.email, user.password);

  await test.step("can create organization via UI form", async () => {
    const hasJwt = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return !!creds.jwt;
    });
    expect(hasJwt).toBe(true);

    await page.goto("/org/ny.html");
    await page.waitForTimeout(500);
    await page.waitForSelector("roi-org-create");

    const slug = uniqueSlug();
    const name = "Min Nye Organisasjon";

    await page.fill('input[name="name"]', name);
    await page.waitForTimeout(100);
    await page.fill('input[name="slug"]', slug);

    await page.click('input[type="submit"]');

    await page.waitForSelector(".success", { timeout: 10000 });

    const successText = await page.textContent(".success");
    expect(successText).toContain("Organisasjonen er oppretta");
    expect(successText).toContain(name);

    const dbOrg = await getOrganization(slug);
    expect(dbOrg).toBeTruthy();
    expect(dbOrg!.name).toBe(name);
  });

  await test.step("shows error for duplicate slug", async () => {
    const slug = uniqueSlug();

    // Create first org
    await page.goto("/org/ny.html");
    await page.waitForSelector("roi-org-create");
    await page.fill('input[name="name"]', "First Org");
    await page.fill('input[name="slug"]', slug);
    await page.click('input[type="submit"]');
    await page.waitForSelector(".success", { timeout: 10000 });

    // Try duplicate
    await page.goto("/org/ny.html");
    await page.waitForSelector("roi-org-create form");
    await page.fill('input[name="name"]', "Second Org");
    await page.fill('input[name="slug"]', slug);
    await page.click('input[type="submit"]');

    await page.waitForSelector(".err", { timeout: 10000 });
    const errorText = await page.textContent(".err");
    expect(errorText).toContain("allereie");
  });
});

// ============================================================================
// Meeting Management
// ============================================================================

test("meeting management flow", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");

  let meetingId: string;

  await test.step("can create meeting under organization", async () => {
    meetingId = uniqueMeetingId();
    const title = "Test Landsmote 2025";

    const meeting = await createMeetingDirect(page, org.id, meetingId, title);

    expect(meeting.id).toBe(meetingId);
    expect(meeting.title).toBe(title);

    const dbMeeting = await getMeeting(meetingId);
    expect(dbMeeting).toBeTruthy();
    expect(dbMeeting!.title).toBe(title);
    expect(dbMeeting!.organizationId).toBe(org.id);
  });

  await test.step("meeting ID must be unique", async () => {
    let error: Error | undefined;
    try {
      await createMeetingDirect(page, org.id, meetingId, "Second Meeting");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/duplicate|unique|already/i);
  });

  await test.step("can update meeting title", async () => {
    const updated = await updateMeetingDirect(page, meetingId, "New Title");
    expect(updated.title).toBe("New Title");

    const dbMeeting = await getMeeting(meetingId);
    expect(dbMeeting!.title).toBe("New Title");
  });

  await test.step("can update meeting config", async () => {
    const config = { speechDisabled: true, video: "youtube123" };
    await updateMeetingDirect(page, meetingId, null, config);

    const dbConfig = await query(
      `SELECT config FROM roiheimen.meeting WHERE id = '${meetingId}'`
    );
    expect(dbConfig).toContain("speechDisabled");
    expect(dbConfig).toContain("youtube123");
  });

  await test.step("can delete meeting", async () => {
    const deleteId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, deleteId, "Meeting to Delete");

    let dbMeeting = await getMeeting(deleteId);
    expect(dbMeeting).toBeTruthy();

    const result = await deleteMeetingDirect(page, deleteId);
    expect(result).toBe(true);

    dbMeeting = await getMeeting(deleteId);
    expect(dbMeeting).toBeNull();
  });
});

test("meeting access control", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

  await test.step("non-member cannot create meeting in organization", async () => {
    const nonMember = await createVerifiedUserFast(page, "NonMember");
    await loginUserFast(page, nonMember.email, nonMember.password);

    let error: Error | undefined;
    try {
      await createMeetingDirect(page, org.id, uniqueMeetingId(), "Hacked Meeting");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/not a member/i);
  });

  await test.step("member cannot create meeting (only admin/owner)", async () => {
    const member = await createVerifiedUserFast(page, "Member");
    await loginUserFast(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(page, org.id, member.email, "MEMBER");

    await loginUserFast(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    let error: Error | undefined;
    try {
      await createMeetingDirect(page, org.id, uniqueMeetingId(), "Member Meeting");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/admin or owner/i);
  });

  await test.step("non-admin cannot delete meeting", async () => {
    const member = await createVerifiedUserFast(page, "DeleteMember");
    await loginUserFast(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(page, org.id, member.email, "MEMBER");

    await loginUserFast(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    let error: Error | undefined;
    try {
      await deleteMeetingDirect(page, meetingId);
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/owners/i);
  });
});

test("meeting RLS policies", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug = uniqueSlug();
  const org = await createOrganizationDirect(page, slug, "Test Org");
  const meetingId = uniqueMeetingId();
  await createMeetingDirect(page, org.id, meetingId, "Private Meeting");

  await test.step("non-member cannot see meetings in organization", async () => {
    const nonMember = await createVerifiedUserFast(page, "NonMember");
    await loginUserFast(page, nonMember.email, nonMember.password);

    const result = await page.evaluate(async (meetingId) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `query GetMeeting($id: String!) { meeting(id: $id) { id title } }`,
          variables: { id: meetingId },
        }),
      });
      return response.json();
    }, meetingId);

    expect(result.data?.meeting).toBeNull();
  });

  await test.step("member can see meetings in organization", async () => {
    const member = await createVerifiedUserFast(page, "Member");
    await loginUserFast(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(page, org.id, member.email, "MEMBER");

    await loginUserFast(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    const result = await page.evaluate(async (meetingId) => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `query GetMeeting($id: String!) { meeting(id: $id) { id title } }`,
          variables: { id: meetingId },
        }),
      });
      return response.json();
    }, meetingId);

    expect(result.data?.meeting).toBeTruthy();
    expect(result.data?.meeting.title).toBe("Private Meeting");
  });
});

// ============================================================================
// Dashboard
// ============================================================================

test("dashboard functionality", async ({ page }) => {
  const owner = await createVerifiedUserFast(page, "Owner");
  await loginUserFast(page, owner.email, owner.password);

  const slug1 = uniqueSlug();
  const slug2 = uniqueSlug();
  await createOrganizationDirect(page, slug1, "Org One");
  const org2 = await createOrganizationDirect(page, slug2, "Org Two");

  const meetingId1 = uniqueMeetingId();
  const meetingId2 = uniqueMeetingId();
  await createMeetingDirect(page, org2.id, meetingId1, "Meeting One");
  await createMeetingDirect(page, org2.id, meetingId2, "Meeting Two");

  await test.step("dashboard shows user's organizations", async () => {
    const orgs = await getMyOrganizations(page);
    expect(orgs.length).toBeGreaterThanOrEqual(2);

    const org1 = orgs.find((o) => o.slug === slug1);
    const foundOrg2 = orgs.find((o) => o.slug === slug2);

    expect(org1).toBeTruthy();
    expect(org1!.name).toBe("Org One");
    expect(foundOrg2).toBeTruthy();
    expect(foundOrg2!.name).toBe("Org Two");
  });

  await test.step("dashboard shows meetings per organization", async () => {
    const result = await page.evaluate(async () => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `query MyOrganizations {
            myOrganizations {
              nodes {
                id slug name
                organizationMeetings { nodes { id title } }
              }
            }
          }`,
        }),
      });
      return response.json();
    });

    if (result.errors) throw new Error(result.errors[0].message);

    const testOrg = result.data.myOrganizations.nodes.find(
      (o: { slug: string }) => o.slug === slug2
    );
    expect(testOrg).toBeTruthy();
    expect(testOrg.organizationMeetings.nodes.length).toBe(2);
  });

  await test.step("activity feed shows recent activity", async () => {
    const result = await page.evaluate(async () => {
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
        },
        body: JSON.stringify({
          query: `mutation GetUserActivity($limit: Int) {
            getUserActivity(input: { activityLimit: $limit }) {
              activityItems {
                activityType activityTitle activityDescription
                activityTimestamp orgSlug meetingId
              }
            }
          }`,
          variables: { limit: 10 },
        }),
      });
      return response.json();
    });

    if (result.errors) throw new Error(result.errors[0].message);

    const items = result.data.getUserActivity.activityItems;
    expect(items.length).toBeGreaterThanOrEqual(2);

    const orgActivity = items.find(
      (item: { activityType: string; orgSlug: string }) =>
        item.activityType === "org_created" && item.orgSlug === slug1
    );
    expect(orgActivity).toBeTruthy();
  });
});

// ============================================================================
// Global Navigation
// ============================================================================

test("global navigation", async ({ page }) => {
  const owner = await createVerifiedUser(page, "NavUser");
  await loginUser(page, owner.email, owner.password);

  const slug1 = uniqueSlug();
  const slug2 = uniqueSlug();
  await createOrganizationDirect(page, slug1, "Org Alpha");
  await createOrganizationDirect(page, slug2, "Org Beta");

  await test.step("org switcher navigates between organizations", async () => {
    await page.goto(`/org-innstillingar.html?slug=${slug1}`);

    await page.waitForSelector("roi-global-nav .dropdown-toggle", { timeout: 15000 });

    const orgDropdownButton = await page.$("roi-global-nav .dropdown-toggle");
    expect(orgDropdownButton).toBeTruthy();

    await orgDropdownButton!.click();
    await page.waitForSelector("roi-global-nav .dropdown-menu", { timeout: 5000 });

    const dropdownText = await page.textContent("roi-global-nav .dropdown-menu");
    expect(dropdownText).toContain("Org Alpha");
    expect(dropdownText).toContain("Org Beta");

    await page.click(`roi-global-nav .dropdown-item:has-text("Org Beta")`);
    await page.waitForURL(`**/org-innstillingar.html?slug=${slug2}`, { timeout: 10000 });

    expect(page.url()).toContain(`slug=${slug2}`);

    // Navigate back
    await page.waitForSelector("roi-global-nav .dropdown-toggle");
    await page.click("roi-global-nav .dropdown-toggle");
    await page.waitForSelector("roi-global-nav .dropdown-menu", { timeout: 5000 });
    await page.click(`roi-global-nav .dropdown-item:has-text("Org Alpha")`);
    await page.waitForURL(`**/org-innstillingar.html?slug=${slug1}`, { timeout: 10000 });

    expect(page.url()).toContain(`slug=${slug1}`);
  });

  await test.step("user menu logout clears session", async () => {
    const hasJwtBefore = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return !!creds.jwt;
    });
    expect(hasJwtBefore).toBe(true);

    const slug = uniqueSlug();
    await createOrganizationDirect(page, slug, "Logout Test Org");

    await page.goto(`/org-innstillingar.html?slug=${slug}`);
    await page.waitForSelector("roi-global-nav .dropdown", { timeout: 15000 });

    const dropdowns = await page.$$("roi-global-nav .dropdown");
    expect(dropdowns.length).toBeGreaterThanOrEqual(2);

    const userDropdown = dropdowns[dropdowns.length - 1];
    const toggleButton = await userDropdown.$(".dropdown-toggle");
    await toggleButton!.click();

    await page.waitForSelector("roi-global-nav .dropdown-menu", { timeout: 5000 });
    await page.click(`roi-global-nav .dropdown-item:has-text("Logg ut")`);

    await page.waitForURL("**/login.html", { timeout: 10000 });

    const hasJwtAfter = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return !!creds.jwt;
    });
    expect(hasJwtAfter).toBe(false);
  });
});
