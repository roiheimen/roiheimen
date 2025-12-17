/**
 * Organization & Meeting Tests
 *
 * Tests organization and meeting management:
 * - Organization CRUD
 * - Organization invites and members
 * - Meeting CRUD
 * - RLS policies
 * - Dashboard and navigation
 */

import {
  test,
  expect,
  uniqueSlug,
  uniqueMeetingId,
  query,
  getUserId,
  getOrganization,
  getOrganizationMember,
  getMeeting,
  createVerifiedUser,
  loginUser,
  createAndLoginUser,
  createVerifiedUserViaUI,
  loginUserViaUI,
  GraphQLClient,
} from "../fixtures";

// ============================================================================
// Organization Management Flow
// ============================================================================

test("organization management flow", async ({ orgOwner }) => {
  const { api, org, user } = orgOwner;

  await test.step("verify owner membership created automatically", async () => {
    expect(org.slug).toBeTruthy();
    expect(org.name).toBe("Test Organisasjon");

    const dbOrg = await getOrganization(org.slug);
    expect(dbOrg).toBeTruthy();

    const userId = await getUserId(user.email);
    const member = await getOrganizationMember(dbOrg!.id, userId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("owner");
  });

  await test.step("can update organization name", async () => {
    const updated = await api.updateOrganization(org.id, "Nytt Namn");
    expect(updated.name).toBe("Nytt Namn");

    const dbOrg = await getOrganization(org.slug);
    expect(dbOrg!.name).toBe("Nytt Namn");
  });

  await test.step("can update organization config", async () => {
    const config = { theme: "dark", feature: true };
    await api.updateOrganization(org.id, null, config);

    const dbConfig = await query(
      `SELECT config FROM roiheimen.organization WHERE slug = '${org.slug}'`
    );
    expect(dbConfig).toContain("dark");
  });
});

test("organization slug validation", async ({ authenticatedUser, api }) => {
  const existingSlug = uniqueSlug();
  await api.createOrganization(existingSlug, "First Org");

  await test.step("slug must be unique", async () => {
    await expect(api.createOrganization(existingSlug, "Second Org")).rejects.toThrow();
  });

  await test.step("rejects invalid characters", async () => {
    await expect(api.createOrganization("test@org", "Test Org")).rejects.toThrow(
      /organization_slug_check/
    );
  });

  await test.step("rejects too short slug", async () => {
    await expect(api.createOrganization("a", "Test Org")).rejects.toThrow(
      /organization_slug_check/
    );
  });

  await test.step("rejects slug with spaces", async () => {
    await expect(api.createOrganization("invalid slug", "Test Org")).rejects.toThrow(
      /organization_slug_check/
    );
  });
});

// ============================================================================
// Organization Invites and Members
// ============================================================================

test("organization invite and member flow", async ({ page, orgOwner }) => {
  const { api, org, user: owner } = orgOwner;

  // Create invitee
  const invitee = await createAndLoginUser(page, "Invitee");
  const inviteeApi = new GraphQLClient(page);

  await test.step("can invite member by email and verify pending invite", async () => {
    // Re-login as owner for invite
    await loginUser(page, owner.email, owner.password);
    const invite = await api.inviteToOrganization(org.id, invitee.email, "MEMBER");
    expect(invite.token).toBeTruthy();
  });

  await test.step("invited user can accept invite and join organization", async () => {
    const dbInvite = await query(
      `SELECT token FROM roiheimen.organization_invite WHERE organization_id = ${org.id} AND lower(email) = lower('${invitee.email}') AND accepted_at IS NULL`
    );
    expect(dbInvite).toBeTruthy();

    await loginUser(page, invitee.email, invitee.password);
    const membership = await inviteeApi.acceptOrganizationInvite(dbInvite);

    expect(membership.role).toBe("MEMBER");

    const inviteeUserId = await getUserId(invitee.email);
    const member = await getOrganizationMember(org.id, inviteeUserId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("member");
  });

  await test.step("member can see organization in their list", async () => {
    const orgs = await inviteeApi.getMyOrganizations();
    const foundOrg = orgs.find((o) => o.slug === org.slug);
    expect(foundOrg).toBeTruthy();
    expect(foundOrg!.name).toBe("Test Organisasjon");
  });

  await test.step("owner can remove member and verify access revoked", async () => {
    await loginUser(page, owner.email, owner.password);

    const memberUserId = await getUserId(invitee.email);
    await api.removeOrganizationMember(org.id, memberUserId);

    const dbMember = await getOrganizationMember(org.id, memberUserId);
    expect(dbMember).toBeNull();

    await loginUser(page, invitee.email, invitee.password);
    const orgs = await inviteeApi.getMyOrganizations();
    expect(orgs.find((o) => o.slug === org.slug)).toBeUndefined();
  });
});

// ============================================================================
// RLS Policies
// ============================================================================

test("organization RLS policies", async ({ page, orgOwner }) => {
  const { api, org, user: owner } = orgOwner;

  // Create non-member
  const nonMember = await createAndLoginUser(page, "NonMember");
  const nonMemberApi = new GraphQLClient(page);

  await test.step("non-member cannot see organization data", async () => {
    const orgs = await nonMemberApi.getMyOrganizations();
    const foundOrg = orgs.find((o) => o.slug === org.slug);
    expect(foundOrg).toBeUndefined();
  });

  await test.step("member cannot edit organization (only admin/owner)", async () => {
    const member = await createAndLoginUser(page, "Member");
    await loginUser(page, owner.email, owner.password);
    const invite = await api.inviteToOrganization(org.id, member.email, "MEMBER");

    await loginUser(page, member.email, member.password);
    const memberApi = new GraphQLClient(page);
    await memberApi.acceptOrganizationInvite(invite.token);

    await expect(memberApi.updateOrganization(org.id, "Hacked Name")).rejects.toThrow(
      /admin or owner/
    );
  });
});

// ============================================================================
// Organization UI
// ============================================================================

test("organization creation UI", async ({ page }) => {
  const user = await createVerifiedUserViaUI(page, "Owner");
  await loginUserViaUI(page, user.email, user.password);

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

    await page.goto("/org/ny.html");
    await page.waitForSelector("roi-org-create");
    await page.fill('input[name="name"]', "First Org");
    await page.fill('input[name="slug"]', slug);
    await page.click('input[type="submit"]');
    await page.waitForSelector(".success", { timeout: 10000 });

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

test("meeting management flow", async ({ meetingAdmin }) => {
  const { api, org, meeting } = meetingAdmin;

  await test.step("verify meeting created under organization", async () => {
    const dbMeeting = await getMeeting(meeting.id);
    expect(dbMeeting).toBeTruthy();
    expect(dbMeeting!.title).toBe("Test Meeting");
    expect(dbMeeting!.organizationId).toBe(org.id);
  });

  await test.step("meeting ID must be unique", async () => {
    await expect(
      api.createMeeting(org.id, meeting.id, "Second Meeting")
    ).rejects.toThrow(/duplicate|unique|already/i);
  });

  await test.step("can update meeting title", async () => {
    const updated = await api.updateMeeting(meeting.id, "New Title");
    expect(updated.title).toBe("New Title");

    const dbMeeting = await getMeeting(meeting.id);
    expect(dbMeeting!.title).toBe("New Title");
  });

  await test.step("can update meeting config", async () => {
    const config = { speechDisabled: true, video: "youtube123" };
    await api.updateMeeting(meeting.id, null, config);

    const dbConfig = await query(
      `SELECT config FROM roiheimen.meeting WHERE id = '${meeting.id}'`
    );
    expect(dbConfig).toContain("speechDisabled");
    expect(dbConfig).toContain("youtube123");
  });

  await test.step("can delete meeting", async () => {
    const deleteId = uniqueMeetingId();
    await api.createMeeting(org.id, deleteId, "Meeting to Delete");

    let dbMeeting = await getMeeting(deleteId);
    expect(dbMeeting).toBeTruthy();

    const result = await api.deleteMeeting(deleteId);
    expect(result).toBe(true);

    dbMeeting = await getMeeting(deleteId);
    expect(dbMeeting).toBeNull();
  });
});

test("meeting access control", async ({ page, meetingAdmin }) => {
  const { api, org, meeting, user: owner } = meetingAdmin;

  await test.step("non-member cannot create meeting in organization", async () => {
    const nonMember = await createAndLoginUser(page, "NonMember");
    const nonMemberApi = new GraphQLClient(page);

    await expect(
      nonMemberApi.createMeeting(org.id, uniqueMeetingId(), "Hacked Meeting")
    ).rejects.toThrow(/not a member/i);
  });

  await test.step("member cannot create meeting (only admin/owner)", async () => {
    const member = await createAndLoginUser(page, "Member");
    await loginUser(page, owner.email, owner.password);
    const invite = await api.inviteToOrganization(org.id, member.email, "MEMBER");

    await loginUser(page, member.email, member.password);
    const memberApi = new GraphQLClient(page);
    await memberApi.acceptOrganizationInvite(invite.token);

    await expect(
      memberApi.createMeeting(org.id, uniqueMeetingId(), "Member Meeting")
    ).rejects.toThrow(/admin or owner/i);
  });

  await test.step("non-admin cannot delete meeting", async () => {
    const member = await createAndLoginUser(page, "DeleteMember");
    await loginUser(page, owner.email, owner.password);
    const invite = await api.inviteToOrganization(org.id, member.email, "MEMBER");

    await loginUser(page, member.email, member.password);
    const memberApi = new GraphQLClient(page);
    await memberApi.acceptOrganizationInvite(invite.token);

    await expect(memberApi.deleteMeeting(meeting.id)).rejects.toThrow(/owners/i);
  });
});

test("meeting RLS policies", async ({ page, meetingAdmin }) => {
  const { api, org, meeting, user: owner } = meetingAdmin;

  await test.step("non-member cannot see meetings in organization", async () => {
    const nonMember = await createAndLoginUser(page, "NonMember");

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
    }, meeting.id);

    expect(result.data?.meeting).toBeNull();
  });

  await test.step("member can see meetings in organization", async () => {
    const member = await createAndLoginUser(page, "Member");
    await loginUser(page, owner.email, owner.password);
    const invite = await api.inviteToOrganization(org.id, member.email, "MEMBER");

    await loginUser(page, member.email, member.password);
    const memberApi = new GraphQLClient(page);
    await memberApi.acceptOrganizationInvite(invite.token);

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
    }, meeting.id);

    expect(result.data?.meeting).toBeTruthy();
    expect(result.data?.meeting.title).toBe("Test Meeting");
  });
});

// ============================================================================
// Dashboard
// ============================================================================

test("dashboard functionality", async ({ orgOwner }) => {
  const { api, org: org2 } = orgOwner;

  const slug1 = uniqueSlug();
  await api.createOrganization(slug1, "Org One");

  const meetingId1 = uniqueMeetingId();
  const meetingId2 = uniqueMeetingId();
  await api.createMeeting(org2.id, meetingId1, "Meeting One");
  await api.createMeeting(org2.id, meetingId2, "Meeting Two");

  await test.step("dashboard shows user's organizations", async () => {
    const orgs = await api.getMyOrganizations();
    expect(orgs.length).toBeGreaterThanOrEqual(2);

    const foundOrg1 = orgs.find((o) => o.slug === slug1);
    const foundOrg2 = orgs.find((o) => o.slug === org2.slug);

    expect(foundOrg1).toBeTruthy();
    expect(foundOrg1!.name).toBe("Org One");
    expect(foundOrg2).toBeTruthy();
  });

  await test.step("dashboard shows meetings per organization", async () => {
    const result = await api.execute<{
      myOrganizations: {
        nodes: Array<{
          id: number;
          slug: string;
          name: string;
          organizationMeetings: { nodes: Array<{ id: string; title: string }> };
        }>;
      };
    }>(
      `query MyOrganizations {
        myOrganizations {
          nodes {
            id slug name
            organizationMeetings { nodes { id title } }
          }
        }
      }`
    );

    const testOrg = result.myOrganizations.nodes.find((o) => o.slug === org2.slug);
    expect(testOrg).toBeTruthy();
    expect(testOrg!.organizationMeetings.nodes.length).toBe(2);
  });

  await test.step("activity feed shows recent activity", async () => {
    const result = await api.execute<{
      getUserActivity: {
        activityItems: Array<{
          activityType: string;
          activityTitle: string;
          activityDescription: string;
          activityTimestamp: string;
          orgSlug: string;
          meetingId: string;
        }>;
      };
    }>(
      `mutation GetUserActivity($limit: Int) {
        getUserActivity(input: { activityLimit: $limit }) {
          activityItems {
            activityType activityTitle activityDescription
            activityTimestamp orgSlug meetingId
          }
        }
      }`,
      { limit: 10 }
    );

    const items = result.getUserActivity.activityItems;
    expect(items.length).toBeGreaterThanOrEqual(2);

    const orgActivity = items.find(
      (item) => item.activityType === "org_created" && item.orgSlug === slug1
    );
    expect(orgActivity).toBeTruthy();
  });
});

// ============================================================================
// Global Navigation
// ============================================================================

test("global navigation", async ({ page }) => {
  const owner = await createVerifiedUserViaUI(page, "NavUser");
  await loginUserViaUI(page, owner.email, owner.password);

  const api = new GraphQLClient(page);
  const slug1 = uniqueSlug();
  const slug2 = uniqueSlug();
  await api.createOrganization(slug1, "Org Alpha");
  await api.createOrganization(slug2, "Org Beta");

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
    await api.createOrganization(slug, "Logout Test Org");

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
