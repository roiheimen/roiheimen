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
 * Helper to register and verify a user, return their email
 */
async function createVerifiedUser(
  page: Page,
  namePrefix: string = "Test"
): Promise<{ email: string; name: string; password: string }> {
  const email = uniqueEmail();
  const name = `${namePrefix} Brukar`;
  const password = "testpassord123";

  // Clear any existing credentials to prevent redirect issues
  // The state.js file has reactors that redirect on JWT errors when a
  // user_jwt_token is used but the old meeting-based auth system tries to
  // load currentPerson.
  //
  // Solution: Use page.route to intercept the GraphQL call that causes the redirect
  // and return an empty response. This prevents the MEETING_FETCH_FAILED action.
  await page.route("**/graphql", async (route, request) => {
    const postData = request.postData() || "";
    // Only intercept the StartInfo query (which fetches currentPerson)
    if (postData.includes("StartInfo") || postData.includes("currentPerson")) {
      // Return empty but valid response to prevent error
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

  // Navigate to registration page
  await page.goto("/registrer.html");
  await page.waitForSelector("roi-signup");

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="password2"]', password);

  await page.click('input[type="submit"]');
  await page.waitForSelector(".success", { timeout: 10000 });

  // Get verification token and verify email
  const token = await query(`
    SELECT ev.token FROM roiheimen_private.email_verification ev
    JOIN roiheimen.user_account ua ON ev.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND ev.used_at IS NULL
    ORDER BY ev.created_at DESC LIMIT 1
  `);

  await page.goto(`/stadfest-epost.html?token=${token}`);
  await page.waitForSelector(".success", { timeout: 10000 });

  // Remove the route interception now that registration is complete
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
 * Helper to get organization by slug
 */
async function getOrganization(
  slug: string
): Promise<{ id: number; name: string; slug: string } | null> {
  const result = await query(
    `SELECT id, name, slug FROM roiheimen.organization WHERE slug = '${slug}'`
  );
  if (!result) return null;
  const [id, name, slug_] = result.split("|");
  return { id: parseInt(id, 10), name, slug: slug_ };
}

/**
 * Helper to get organization member
 */
async function getOrganizationMember(
  orgId: number,
  userId: number
): Promise<{ role: string } | null> {
  const result = await query(
    `SELECT role FROM roiheimen.organization_member WHERE organization_id = ${orgId} AND user_id = ${userId}`
  );
  if (!result) return null;
  return { role: result };
}

/**
 * Helper to get pending invite for an email in an org
 */
async function getOrganizationInvite(
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
      // Use direct API URL to bypass proxy issues
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
 * Helper to invite to organization via GraphQL
 */
async function inviteToOrganizationDirect(
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

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return { token: result.data.inviteToOrganization.organizationInvite.token };
}

/**
 * Helper to update organization via GraphQL
 */
async function updateOrganizationDirect(
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

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.updateOrganization.organization;
}

/**
 * Helper to remove organization member via GraphQL
 */
async function removeOrganizationMemberDirect(
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

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.removeOrganizationMember.boolean;
}

/**
 * Helper to accept organization invite via GraphQL
 */
async function acceptOrganizationInviteDirect(
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

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.acceptOrganizationInvite.organizationMember;
}

/**
 * Helper to get my organizations via GraphQL
 */
async function getMyOrganizations(
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

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.myOrganizations.nodes;
}

test.describe("Organization Creation", () => {
  test("can create organization and verify owner membership", async ({
    page,
  }) => {
    // Create and login as verified user
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    const slug = uniqueSlug();
    const name = "Test Organisasjon";

    // Create organization
    const org = await createOrganizationDirect(page, slug, name);

    expect(org.slug).toBe(slug);
    expect(org.name).toBe(name);

    // Verify in database
    const dbOrg = await getOrganization(slug);
    expect(dbOrg).toBeTruthy();
    expect(dbOrg!.name).toBe(name);

    // Verify user is owner
    const userId = await getUserId(user.email);
    const member = await getOrganizationMember(dbOrg!.id, userId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("owner");
  });

  test("organization slug must be unique", async ({ page }) => {
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    const slug = uniqueSlug();
    const name = "First Org";

    // Create first organization
    await createOrganizationDirect(page, slug, name);

    // Try to create another with same slug - should fail
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, slug, "Second Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
  });

  test("organization slug validation rejects invalid slugs", async ({
    page,
  }) => {
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    // Note: The database normalizes slugs to lowercase, so uppercase is allowed
    // but converted. Only invalid characters and length constraints are enforced.

    // Test slug with spaces (spaces are not allowed in slugs)
    let error: Error | undefined;
    try {
      await createOrganizationDirect(page, "invalid slug", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");

    // Test too short slug (min 2 chars)
    error = undefined;
    try {
      await createOrganizationDirect(page, "a", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");

    // Test invalid characters (only a-z, 0-9, and - are allowed)
    error = undefined;
    try {
      await createOrganizationDirect(page, "test@org", "Test Org");
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain("organization_slug_check");
  });
});

test.describe("Organization Update", () => {
  test("owner can update organization name", async ({ page }) => {
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Original Name");

    // Update name
    const updated = await updateOrganizationDirect(page, org.id, "New Name");
    expect(updated.name).toBe("New Name");

    // Verify in database
    const dbOrg = await getOrganization(slug);
    expect(dbOrg!.name).toBe("New Name");
  });

  test("owner can update organization config", async ({ page }) => {
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Update config
    const config = { theme: "dark", feature: true };
    const updated = await updateOrganizationDirect(page, org.id, null, config);

    // Verify in database
    const dbConfig = await query(
      `SELECT config FROM roiheimen.organization WHERE slug = '${slug}'`
    );
    expect(dbConfig).toContain("dark");
  });
});

test.describe("Organization Invites", () => {
  test("can invite member by email and verify pending invite", async ({
    page,
  }) => {
    // Create owner and login
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    // Create organization
    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Create another user to invite (but don't login as them yet)
    const inviteeEmail = uniqueEmail();

    // Invite the user
    const invite = await inviteToOrganizationDirect(
      page,
      org.id,
      inviteeEmail,
      "MEMBER"
    );
    expect(invite.token).toBeTruthy();

    // Verify invite in database
    const dbOrg = await getOrganization(slug);
    const dbInvite = await getOrganizationInvite(dbOrg!.id, inviteeEmail);
    expect(dbInvite).toBeTruthy();
    expect(dbInvite!.role).toBe("member");
  });

  test("invited user can accept invite and join organization", async ({
    page,
  }) => {
    // Create owner and login
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    // Create organization
    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Create another user (need to create and verify in a separate context)
    // We'll use a new page context for this
    const invitee = await createVerifiedUser(page, "Invitee");

    // Login back as owner and invite
    await loginUser(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(
      page,
      org.id,
      invitee.email,
      "MEMBER"
    );

    // Login as invitee and accept
    await loginUser(page, invitee.email, invitee.password);
    const membership = await acceptOrganizationInviteDirect(page, invite.token);

    expect(membership.role).toBe("MEMBER");

    // Verify in database
    const inviteeUserId = await getUserId(invitee.email);
    const dbOrg = await getOrganization(slug);
    const member = await getOrganizationMember(dbOrg!.id, inviteeUserId);
    expect(member).toBeTruthy();
    expect(member!.role).toBe("member");
  });
});

test.describe("RLS Policies", () => {
  test("non-member cannot see organization data", async ({ page }) => {
    // Create owner and organization
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    await createOrganizationDirect(page, slug, "Private Org");

    // Create another user who is not a member
    const nonMember = await createVerifiedUser(page, "NonMember");
    await loginUser(page, nonMember.email, nonMember.password);

    // Try to get organizations - should not see the private one
    const orgs = await getMyOrganizations(page);
    const foundOrg = orgs.find((o) => o.slug === slug);
    expect(foundOrg).toBeUndefined();
  });

  test("member can view organization data", async ({ page }) => {
    // Create owner and organization
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Create and invite a member
    const member = await createVerifiedUser(page, "Member");

    // Login back as owner and invite
    await loginUser(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(
      page,
      org.id,
      member.email,
      "MEMBER"
    );

    // Login as member and accept invite
    await loginUser(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    // Member should see the organization
    const orgs = await getMyOrganizations(page);
    const foundOrg = orgs.find((o) => o.slug === slug);
    expect(foundOrg).toBeTruthy();
    expect(foundOrg!.name).toBe("Test Org");
  });

  test("member cannot edit organization (only admin/owner)", async ({
    page,
  }) => {
    // Create owner and organization
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Create and invite a member
    const member = await createVerifiedUser(page, "Member");

    // Login back as owner and invite
    await loginUser(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(
      page,
      org.id,
      member.email,
      "MEMBER"
    );

    // Login as member and accept invite
    await loginUser(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    // Member should not be able to update
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

test.describe("Remove Member", () => {
  test("owner can remove member and verify access revoked", async ({
    page,
  }) => {
    // Create owner and organization
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    // Create and invite a member
    const member = await createVerifiedUser(page, "Member");

    // Login back as owner and invite
    await loginUser(page, owner.email, owner.password);
    const invite = await inviteToOrganizationDirect(
      page,
      org.id,
      member.email,
      "MEMBER"
    );

    // Login as member and accept invite
    await loginUser(page, member.email, member.password);
    await acceptOrganizationInviteDirect(page, invite.token);

    // Verify member can see org
    let orgs = await getMyOrganizations(page);
    expect(orgs.find((o) => o.slug === slug)).toBeTruthy();

    // Login as owner and remove member
    await loginUser(page, owner.email, owner.password);
    const memberUserId = await getUserId(member.email);
    await removeOrganizationMemberDirect(page, org.id, memberUserId);

    // Verify in database
    const dbOrg = await getOrganization(slug);
    const dbMember = await getOrganizationMember(dbOrg!.id, memberUserId);
    expect(dbMember).toBeNull();

    // Login as ex-member and verify no access
    await loginUser(page, member.email, member.password);
    orgs = await getMyOrganizations(page);
    expect(orgs.find((o) => o.slug === slug)).toBeUndefined();
  });
});

test.describe("Organization Creation UI", () => {
  test("can create organization via UI form", async ({ page }) => {
    // Create and login as verified user
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    // Verify we're logged in and have JWT in localStorage
    const hasJwt = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return !!creds.jwt;
    });
    expect(hasJwt).toBe(true);

    // Go to org creation page
    await page.goto("/org/ny.html");

    // Give a moment for the component to initialize
    await page.waitForTimeout(500);

    // Check if we're still on the org page (not redirected to login)
    const url = page.url();
    expect(url).toContain("/org/ny.html");

    await page.waitForSelector("roi-org-create");

    const slug = uniqueSlug();
    const name = "Min Nye Organisasjon";

    // Fill the form
    await page.fill('input[name="name"]', name);
    // Wait for auto-generated slug
    await page.waitForTimeout(100);
    // Override with our specific slug
    await page.fill('input[name="slug"]', slug);

    // Submit
    await page.click('input[type="submit"]');

    // Wait for success message
    await page.waitForSelector(".success", { timeout: 10000 });

    // Verify success message
    const successText = await page.textContent(".success");
    expect(successText).toContain("Organisasjonen er oppretta");
    expect(successText).toContain(name);

    // Verify in database
    const dbOrg = await getOrganization(slug);
    expect(dbOrg).toBeTruthy();
    expect(dbOrg!.name).toBe(name);
  });

  test("shows error for duplicate slug", async ({ page }) => {
    // Create and login as verified user
    const user = await createVerifiedUser(page, "Owner");
    await loginUser(page, user.email, user.password);

    const slug = uniqueSlug();

    // Create first organization via UI
    await page.goto("/org/ny.html");
    await page.waitForSelector("roi-org-create");
    await page.fill('input[name="name"]', "First Org");
    await page.fill('input[name="slug"]', slug);
    await page.click('input[type="submit"]');
    await page.waitForSelector(".success", { timeout: 10000 });

    // Go back and try to create another with same slug
    await page.goto("/org/ny.html");
    await page.waitForSelector("roi-org-create form");  // Wait for fresh form

    await page.fill('input[name="name"]', "Second Org");
    await page.fill('input[name="slug"]', slug);

    // Submit
    await page.click('input[type="submit"]');

    // Should show error about duplicate
    await page.waitForSelector(".err", { timeout: 10000 });
    const errorText = await page.textContent(".err");
    expect(errorText).toContain("allereie");  // "Det finst allereie ein organisasjon..."
  });
});

test.describe("Dashboard", () => {
  test("dashboard shows user's organizations", async ({ page }) => {
    // Create owner and two organizations
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug1 = uniqueSlug();
    const slug2 = uniqueSlug();
    await createOrganizationDirect(page, slug1, "Org One");
    await createOrganizationDirect(page, slug2, "Org Two");

    // Get my organizations
    const orgs = await getMyOrganizations(page);
    expect(orgs.length).toBeGreaterThanOrEqual(2);

    const org1 = orgs.find((o) => o.slug === slug1);
    const org2 = orgs.find((o) => o.slug === slug2);

    expect(org1).toBeTruthy();
    expect(org1!.name).toBe("Org One");
    expect(org2).toBeTruthy();
    expect(org2!.name).toBe("Org Two");
  });
});
