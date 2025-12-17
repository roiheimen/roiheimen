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
  meetingId: string
): Promise<{ id: number; code: string }> {
  const result = await page.evaluate(async (meetingId) => {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(localStorage.getItem("creds") || "{}").jwt}`,
      },
      body: JSON.stringify({
        query: `
          mutation CreateInviteCode($meetingId: String!) {
            createInviteCode(input: { pMeetingId: $meetingId }) {
              meetingInvite {
                id
                code
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
  return result.data.createInviteCode.meetingInvite;
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
 */
async function getMeetingTokenDirect(page: Page, meetingId: string): Promise<string> {
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
 * Helper to set the meeting JWT in localStorage
 */
async function setMeetingJwt(page: Page, jwt: string): Promise<void> {
  await page.evaluate((jwt) => {
    localStorage.setItem("creds", JSON.stringify({ jwt }));
  }, jwt);
}

/**
 * Helper to create a sak (agenda item) via GraphQL
 */
async function createSakDirect(
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
                sak {
                  id
                  title
                }
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

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.createSak.sak;
}

test.describe("Display Pages (gfx.html, screen.html, fullscreen.html)", () => {
  test("gfx.html loads with meeting-scoped JWT", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token (owner is automatically an organizer)
    const jwt = await getMeetingTokenDirect(page, meetingId);

    // Set the meeting JWT
    await setMeetingJwt(page, jwt);

    // Create a sak so the components have data to display
    await createSakDirect(page, meetingId, "Gfx Test Sak");

    // Navigate to gfx.html
    await page.goto(`/gfx.html?m=${meetingId}`);

    // Wait for the title component to show content
    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    // Verify title is displayed
    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Gfx Test Sak");

    // Page should load without critical errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Wait a bit for potential errors
    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  });

  test("screen.html loads with meeting-scoped JWT", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, jwt);

    // Create a sak so the components have data to display
    await createSakDirect(page, meetingId, "Screen Test Sak");

    // Navigate to screen.html
    await page.goto(`/screen.html?m=${meetingId}`);

    // Wait for the title component to show content
    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    // Verify title is displayed
    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Screen Test Sak");

    // Page should load without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  });

  test("fullscreen.html loads with meeting-scoped JWT", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, jwt);

    // Create a sak so the components have data to display
    await createSakDirect(page, meetingId, "Fullscreen Test Sak");

    // Navigate to fullscreen.html
    await page.goto(`/fullscreen.html?m=${meetingId}`);

    // Wait for the title component to show content
    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    // Verify title is displayed
    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Fullscreen Test Sak");

    // Page should load without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  });

  test("gfx.html displays sak title correctly", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, jwt);

    // Create a sak (agenda item)
    const sak = await createSakDirect(page, meetingId, "Sak 1: Åpning av møtet");

    // Navigate to gfx.html
    await page.goto(`/gfx.html?m=${meetingId}`);

    // Wait for the title component
    await page.waitForSelector("roi-gfx-title", { timeout: 10000 });

    // Wait for sak subscription to load the title
    await page.waitForTimeout(3000);

    // The title should display the sak title
    const titleElement = await page.locator("roi-gfx-title h1");
    const titleText = await titleElement.textContent();

    expect(titleText).toContain("Sak 1: Åpning av møtet");
  });

  test("screen.html shows content when sak exists", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, jwt);

    // Create a sak
    await createSakDirect(page, meetingId, "Screen Sak Test");

    // Navigate to screen.html
    await page.goto(`/screen.html?m=${meetingId}`);

    // Wait for the title component
    await page.waitForSelector("roi-gfx-title h1", { timeout: 10000 });

    // Verify title is displayed
    const titleElement = await page.locator("roi-gfx-title h1");
    await expect(titleElement).toContainText("Screen Sak Test");

    // With no speeches, the speeches list component may not be visible
    // but the page should load without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  });

  test("fullscreen.html works for audience display", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    // Get meeting token
    const jwt = await getMeetingTokenDirect(page, meetingId);
    await setMeetingJwt(page, jwt);

    // Create a sak
    const sak = await createSakDirect(page, meetingId, "Forslag til vedtak");

    // Navigate to fullscreen.html
    await page.goto(`/fullscreen.html?m=${meetingId}`);

    // Wait for components
    await page.waitForSelector("roi-gfx-title", { timeout: 10000 });

    // Wait for subscription
    await page.waitForTimeout(3000);

    // Verify title is shown
    const titleElement = await page.locator("roi-gfx-title h1");
    const titleText = await titleElement.textContent();

    expect(titleText).toContain("Forslag til vedtak");

    // Verify no errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    expect(errors.length).toBe(0);
  });

  test("display pages work with participant JWT (via invite)", async ({ page }) => {
    // Create owner, org, and meeting
    const owner = await createVerifiedUser(page, "Owner");
    await loginUser(page, owner.email, owner.password);

    const slug = uniqueSlug();
    const org = await createOrganizationDirect(page, slug, "Test Org");

    const meetingId = uniqueMeetingId();
    await createMeetingDirect(page, org.id, meetingId, "Test Meeting");

    const invite = await createInviteCodeDirect(page, meetingId);

    // Store owner's token temporarily
    const ownerJwt = await getMeetingTokenDirect(page, meetingId);

    // Create participant and join via invite
    const participant = await createVerifiedUser(page, "Deltaker");
    await loginUser(page, participant.email, participant.password);
    await joinMeetingDirect(page, meetingId, invite.code, "Test Deltaker");

    // Get participant's meeting token
    const participantJwt = await getMeetingTokenDirect(page, meetingId);

    // Use owner's token to create a sak
    await setMeetingJwt(page, ownerJwt);
    await createSakDirect(page, meetingId, "Deltaker-test Sak");

    // Use participant's token to access gfx.html
    await setMeetingJwt(page, participantJwt);

    // Navigate to gfx.html as participant
    await page.goto(`/gfx.html?m=${meetingId}`);

    // Wait for components
    await page.waitForSelector("roi-gfx-title", { timeout: 10000 });

    // Wait for subscriptions
    await page.waitForTimeout(3000);

    // Verify title shows the sak
    const titleElement = await page.locator("roi-gfx-title h1");
    const titleText = await titleElement.textContent();

    expect(titleText).toContain("Deltaker-test Sak");

    // Verify no errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    expect(errors.length).toBe(0);
  });
});
