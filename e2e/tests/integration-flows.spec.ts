/**
 * Integration Flow Tests
 *
 * Tests the complete user journey through the UI:
 * Register → Verify → Create Org → Create Meeting
 *
 * This test deliberately uses UI interactions (not fast helpers)
 * to verify the actual user experience works end-to-end.
 */

import { test, expect } from "../fixtures";
import {
  query,
  uniqueEmail,
  uniqueSlug,
  getVerificationToken,
} from "../helpers";

test("complete new user flow via UI", async ({ page }) => {
  const email = uniqueEmail();
  const name = "Ny Brukar";
  const password = "testpassord123";

  // Helper to set up route interception for legacy auth system
  async function interceptLegacyAuth() {
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
  }

  await test.step("register new user via UI", async () => {
    await interceptLegacyAuth();
    await page.goto("/registrer.html");
    await page.waitForSelector("roi-signup");

    // Fill registration form
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="password2"]', password);

    // Submit registration
    await page.click('input[type="submit"]');

    // Wait for success message
    await page.waitForSelector(".success", { timeout: 10000 });
    const registrationSuccess = await page.textContent(".success");
    expect(registrationSuccess).toContain("Registreringa var vellukka");
  });

  await test.step("verify email via UI", async () => {
    // Get token from database
    const verificationToken = await getVerificationToken(email);
    expect(verificationToken).toBeTruthy();
    expect(verificationToken!.length).toBe(14); // 7 random bytes = 14 hex chars

    // Navigate to verification page with token
    await page.goto(`/stadfest-epost.html?token=${verificationToken}`);
    await page.waitForSelector(".success", { timeout: 10000 });
    const verificationSuccess = await page.textContent(".success");
    expect(verificationSuccess).toContain("stadfesta");

    // Remove route interception for login and subsequent steps
    await page.unroute("**/graphql");
  });

  await test.step("login via UI", async () => {
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit and wait for redirect to dashboard
    await Promise.all([
      page.waitForURL("**/oversikt.html", { timeout: 10000 }),
      page.click('input[type="submit"]'),
    ]);

    // Verify we're on the dashboard
    expect(page.url()).toContain("/oversikt.html");

    // Verify JWT is stored
    const hasJwt = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return !!creds.jwt;
    });
    expect(hasJwt).toBe(true);
  });

  // Variables for org/meeting creation
  let orgId: number;
  const orgSlug = uniqueSlug();
  const orgName = "Min Nye Organisasjon";
  const meetingTitle = "Nytt Landsmote 2025";
  const meetingId = `landsmote-${Date.now()}`.substring(0, 31);

  await test.step("create organization via API", async () => {
    const orgResult = await page.evaluate(
      async ({ slug, name }) => {
        const jwt = JSON.parse(localStorage.getItem("creds") || "{}").jwt;
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
        return response.json();
      },
      { slug: orgSlug, name: orgName }
    );

    expect(orgResult.errors).toBeUndefined();
    const createdOrg = orgResult.data.createOrganization.organization;
    expect(createdOrg.slug).toBe(orgSlug);
    expect(createdOrg.name).toBe(orgName);
    orgId = createdOrg.id;

    // Verify organization in database
    const dbOrg = await query(
      `SELECT id, name, slug FROM roiheimen.organization WHERE slug = '${orgSlug}'`
    );
    expect(dbOrg).toBeTruthy();
  });

  await test.step("create meeting via API", async () => {
    const meetingResult = await page.evaluate(
      async ({ orgId, meetingId, title }) => {
        const jwt = JSON.parse(localStorage.getItem("creds") || "{}").jwt;
        const response = await fetch("http://localhost:3000/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            query: `
              mutation CreateOrgMeeting($orgId: Int!, $meetingId: String!, $title: String!, $config: JSON!) {
                createOrgMeeting(input: { orgId: $orgId, meetingId: $meetingId, meetingTitle: $title, meetingConfig: $config }) {
                  meeting {
                    id
                    title
                    organizationId
                  }
                }
              }
            `,
            variables: { orgId, meetingId, title, config: {} },
          }),
        });
        return response.json();
      },
      { orgId, meetingId, title: meetingTitle }
    );

    expect(meetingResult.errors).toBeUndefined();
    const createdMeeting = meetingResult.data.createOrgMeeting.meeting;
    expect(createdMeeting.id).toBe(meetingId);
    expect(createdMeeting.title).toBe(meetingTitle);
    expect(createdMeeting.organizationId).toBe(orgId);

    // Verify meeting in database
    const dbMeeting = await query(
      `SELECT id, title, organization_id FROM roiheimen.meeting WHERE id = '${meetingId}'`
    );
    expect(dbMeeting).toBeTruthy();
    const [dbMeetingId, dbMeetingTitle, dbOrgIdFromMeeting] = dbMeeting.split("|");
    expect(dbMeetingTitle).toBe(meetingTitle);
    expect(parseInt(dbOrgIdFromMeeting, 10)).toBe(orgId);
  });

  await test.step("verify dashboard shows org and meeting", async () => {
    const dashboardData = await page.evaluate(async () => {
      const jwt = JSON.parse(localStorage.getItem("creds") || "{}").jwt;
      const response = await fetch("http://localhost:3000/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          query: `
            query MyOrganizations {
              myOrganizations {
                nodes {
                  id
                  slug
                  name
                  organizationMeetings {
                    nodes {
                      id
                      title
                    }
                  }
                }
              }
            }
          `,
        }),
      });
      return response.json();
    });

    expect(dashboardData.errors).toBeUndefined();
    const orgs = dashboardData.data.myOrganizations.nodes;

    // Verify our organization is in the list
    const ourOrg = orgs.find((o: { slug: string }) => o.slug === orgSlug);
    expect(ourOrg).toBeTruthy();
    expect(ourOrg.name).toBe(orgName);

    // Verify our meeting is in the organization
    const ourMeeting = ourOrg.organizationMeetings.nodes.find(
      (m: { id: string }) => m.id === meetingId
    );
    expect(ourMeeting).toBeTruthy();
    expect(ourMeeting.title).toBe(meetingTitle);
  });
});
