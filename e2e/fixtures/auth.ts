/**
 * Authentication fixtures
 *
 * Provides fixtures for user creation and authentication.
 */

import { test as base, Page } from "@playwright/test";
import { GraphQLClient, setJwt } from "./api";
import { query, uniqueEmail } from "./db";

export interface UserCredentials {
  email: string;
  name: string;
  password: string;
}

export interface AuthenticatedUser extends UserCredentials {
  id: number;
  jwt: string;
}

/**
 * Create a verified user via API (fast, for setup)
 */
export async function createVerifiedUser(
  page: Page,
  namePrefix: string = "Test"
): Promise<UserCredentials> {
  const email = uniqueEmail();
  const name = `${namePrefix} Brukar`;
  const password = "testpassord123";

  // Ensure we're on a page (needed for fetch to work from browser context)
  const currentUrl = page.url();
  if (currentUrl === "about:blank" || !currentUrl.startsWith("http")) {
    await page.goto("/");
  }

  const api = new GraphQLClient(page);
  await api.register(email, password, name);

  // Small delay to ensure transaction commits
  await new Promise(r => setTimeout(r, 100));

  // Verify email directly via DB
  await query(`
    UPDATE roiheimen_private.user_credentials uc
    SET email_verified = true
    FROM roiheimen.user_account ua
    WHERE uc.user_id = ua.id AND lower(ua.email) = lower('${email}')
  `);

  return { email, name, password };
}

/**
 * Login a user and store JWT in localStorage
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<string> {
  const api = new GraphQLClient(page);
  const jwt = await api.login(email, password);
  await setJwt(page, jwt);
  return jwt;
}

/**
 * Create and login a verified user in one step
 */
export async function createAndLoginUser(
  page: Page,
  namePrefix: string = "Test"
): Promise<AuthenticatedUser> {
  const user = await createVerifiedUser(page, namePrefix);
  const jwt = await loginUser(page, user.email, user.password);

  const idResult = await query(
    `SELECT id FROM roiheimen.user_account WHERE lower(email) = lower('${user.email}')`
  );

  return {
    ...user,
    id: parseInt(idResult, 10),
    jwt,
  };
}

// ============================================================================
// UI-based helpers (for testing the UI flows themselves)
// ============================================================================

/**
 * Register a user via the UI (for testing registration flow)
 */
export async function registerUserViaUI(
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
 * Login a user via the UI (for testing login flow)
 */
export async function loginUserViaUI(
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
 * Create a verified user via UI (full flow - use for UI testing)
 */
export async function createVerifiedUserViaUI(
  page: Page,
  namePrefix: string = "Test"
): Promise<UserCredentials> {
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

  await registerUserViaUI(page, name, email, password);

  // Get verification token and verify via UI
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

// ============================================================================
// Fixture Definitions
// ============================================================================

export type AuthFixtures = {
  /** GraphQL API client with auto-auth from localStorage */
  api: GraphQLClient;

  /** A verified, logged-in user (created fresh for each test) */
  authenticatedUser: AuthenticatedUser;
};

/**
 * Auth fixtures to extend test with
 */
export const authFixtures = base.extend<AuthFixtures>({
  api: async ({ page }, use) => {
    // Ensure page is loaded for API calls
    const currentUrl = page.url();
    if (currentUrl === "about:blank" || !currentUrl.startsWith("http")) {
      await page.goto("/");
    }
    await use(new GraphQLClient(page));
  },

  authenticatedUser: async ({ page }, use) => {
    const user = await createAndLoginUser(page, "Test");
    await use(user);
    // No explicit teardown needed - test isolation handles cleanup
  },
});
