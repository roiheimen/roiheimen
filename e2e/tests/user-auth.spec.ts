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
  // -A removes alignment padding, -t removes headers, PSQLRC=/dev/null skips rc file
  // Split by pipe to get first column if there are multiple columns
  const lines = stdout.trim().split("\n").filter(line => line && !line.startsWith("Pager") && !line.startsWith("Expanded") && !line.startsWith("Null"));
  return lines[0] || "";
}

/**
 * Helper to generate unique test emails
 */
function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/**
 * Helper to register a user via the UI
 */
async function registerUser(
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

  // Wait for success message
  await page.waitForSelector(".success", { timeout: 10000 });
  await expect(page.locator(".success")).toContainText(
    "Registreringa var vellukka"
  );
}

/**
 * Helper to get verification token from database for an email
 */
async function getVerificationToken(email: string): Promise<string | null> {
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
 * Helper to get password reset token from database for an email
 */
async function getPasswordResetToken(email: string): Promise<string | null> {
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
 * Helper to check if a user's email is verified
 */
async function isEmailVerified(email: string): Promise<boolean> {
  const result = await query(`
    SELECT uc.email_verified FROM roiheimen_private.user_credentials uc
    JOIN roiheimen.user_account ua ON uc.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
  `);
  return result === "t";
}

/**
 * Helper to get failed login attempts for a user
 */
async function getFailedAttempts(email: string): Promise<number> {
  const result = await query(`
    SELECT uc.failed_attempts FROM roiheimen_private.user_credentials uc
    JOIN roiheimen.user_account ua ON uc.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
  `);
  return parseInt(result || "0", 10);
}

test.describe("User Registration", () => {
  test("can register new user and verification token is created in DB", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    await registerUser(page, name, email, password);

    // Verify token exists in database
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();
    expect(token!.length).toBe(14); // 7 random bytes = 14 hex chars

    // Verify email is not yet verified
    const verified = await isEmailVerified(email);
    expect(verified).toBe(false);
  });

  test("registration fails with weak password", async ({ page }) => {
    await page.goto("/registrer.html");
    await page.waitForSelector("roi-signup");

    await page.fill('input[name="name"]', "Test Brukar");
    await page.fill('input[name="email"]', uniqueEmail());
    // Use 7 chars - just under the 8 char minimum
    await page.fill('input[name="password"]', "1234567");
    await page.fill('input[name="password2"]', "1234567");

    // Remove minlength attribute to bypass HTML5 validation and test JS validation
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[minlength]');
      inputs.forEach((input) => input.removeAttribute("minlength"));
    });

    await page.click('input[type="submit"]');

    // Should show error about password length
    await expect(page.locator(".err")).toContainText("minst 8 teikn");
  });

  test("registration fails with mismatched passwords", async ({ page }) => {
    await page.goto("/registrer.html");
    await page.waitForSelector("roi-signup");

    await page.fill('input[name="name"]', "Test Brukar");
    await page.fill('input[name="email"]', uniqueEmail());
    await page.fill('input[name="password"]', "testpassord123");
    await page.fill('input[name="password2"]', "testpassord456");

    await page.click('input[type="submit"]');

    // Should show error about mismatched passwords
    await expect(page.locator(".err")).toContainText("ikkje like");
  });
});

test.describe("Email Verification", () => {
  test("can verify email using token from DB", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register user
    await registerUser(page, name, email, password);

    // Get token from database
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();

    // Navigate to verification page with token
    await page.goto(`/stadfest-epost.html?token=${token}`);

    // Wait for success message
    await page.waitForSelector(".success", { timeout: 10000 });
    await expect(page.locator(".success")).toContainText("stadfesta");

    // Verify email is now verified in database
    const verified = await isEmailVerified(email);
    expect(verified).toBe(true);
  });

  test("verification fails with invalid token", async ({ page }) => {
    await page.goto("/stadfest-epost.html?token=invalidtoken123");

    // Wait for error message
    await page.waitForSelector(".error", { timeout: 10000 });
    await expect(page.locator(".error")).toBeVisible();
  });
});

test.describe("User Login", () => {
  test("verified user can login and receives JWT", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register and verify user
    await registerUser(page, name, email, password);
    const token = await getVerificationToken(email);
    await page.goto(`/stadfest-epost.html?token=${token}`);
    await page.waitForSelector(".success");

    // Now try to login
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit and wait for redirect to oversikt page (login successful)
    await Promise.all([
      page.waitForURL("**/oversikt.html", { timeout: 10000 }),
      page.click('input[type="submit"]'),
    ]);

    // Verify we're on the dashboard and JWT is stored
    const jwt = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return creds.jwt;
    });
    expect(jwt).toBeTruthy();
  });

  test("unverified user cannot login", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register but don't verify
    await registerUser(page, name, email, password);

    // Try to login
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    await page.click('input[type="submit"]');

    // Should show error about unverified email
    await expect(page.locator(".err")).toContainText("ikkje stadfesta");
  });

  test("login fails with wrong password", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register and verify user
    await registerUser(page, name, email, password);
    const token = await getVerificationToken(email);
    await page.goto(`/stadfest-epost.html?token=${token}`);
    await page.waitForSelector(".success");

    // Try to login with wrong password
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "wrongpassword");

    await page.click('input[type="submit"]');

    // Should show error
    await expect(page.locator(".err")).toBeVisible();
  });
});

test.describe("Brute Force Protection", () => {
  test("account locks after 3 failed attempts", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register and verify user
    await registerUser(page, name, email, password);
    const token = await getVerificationToken(email);
    await page.goto(`/stadfest-epost.html?token=${token}`);
    await page.waitForSelector(".success");

    // Attempt login with wrong password 3 times
    for (let i = 0; i < 3; i++) {
      await page.goto("/login.html");
      await page.waitForSelector("roi-login");

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', "wrongpassword");

      await page.click('input[type="submit"]');

      // Wait for error
      await page.waitForSelector(".err");
    }

    // Verify failed attempts in DB
    const attempts = await getFailedAttempts(email);
    expect(attempts).toBeGreaterThanOrEqual(3);

    // Try to login with correct password - should be locked
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    await page.click('input[type="submit"]');

    // Should show account locked message
    await expect(page.locator(".err")).toContainText("låst");
  });
});

test.describe("Password Reset", () => {
  test("can request password reset and token is created in DB", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    // Register and verify user
    await registerUser(page, name, email, password);
    const verifyToken = await getVerificationToken(email);
    await page.goto(`/stadfest-epost.html?token=${verifyToken}`);
    await page.waitForSelector(".success");

    // Request password reset
    await page.goto("/gloeymt-passord.html");
    await page.waitForSelector("roi-password-reset-request");

    await page.fill('input[name="email"]', email);
    await page.click('input[type="submit"]');

    // Wait for success message (always shows success to prevent enumeration)
    await page.waitForSelector(".success", { timeout: 10000 });

    // Verify reset token exists in database
    const resetToken = await getPasswordResetToken(email);
    expect(resetToken).toBeTruthy();
    expect(resetToken!.length).toBe(14); // 7 random bytes = 14 hex chars
  });

  test("can reset password with token and login with new password", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const oldPassword = "testpassord123";
    const newPassword = "nyttpassord456";

    // Register and verify user
    await registerUser(page, name, email, oldPassword);
    const verifyToken = await getVerificationToken(email);
    await page.goto(`/stadfest-epost.html?token=${verifyToken}`);
    await page.waitForSelector(".success");

    // Request password reset
    await page.goto("/gloeymt-passord.html");
    await page.waitForSelector("roi-password-reset-request");

    await page.fill('input[name="email"]', email);
    await page.click('input[type="submit"]');
    await page.waitForSelector(".success");

    // Get reset token from database
    const resetToken = await getPasswordResetToken(email);
    expect(resetToken).toBeTruthy();

    // Use reset token to set new password
    await page.goto(`/nullstill-passord.html?token=${resetToken}`);
    await page.waitForSelector("roi-password-reset");

    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="password2"]', newPassword);
    await page.click('input[type="submit"]');

    // Wait for success
    await page.waitForSelector(".success", { timeout: 10000 });

    // Login with new password
    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', newPassword);

    // Submit and wait for redirect to oversikt page (login successful)
    await Promise.all([
      page.waitForURL("**/oversikt.html", { timeout: 10000 }),
      page.click('input[type="submit"]'),
    ]);

    // Verify we're on the dashboard and JWT is stored
    const jwt = await page.evaluate(() => {
      const creds = JSON.parse(localStorage.getItem("creds") || "{}");
      return creds.jwt;
    });
    expect(jwt).toBeTruthy();
  });

  test("password reset fails with invalid token", async ({ page }) => {
    await page.goto("/nullstill-passord.html?token=invalidtoken123");
    await page.waitForSelector("roi-password-reset");

    await page.fill('input[name="password"]', "newpassword123");
    await page.fill('input[name="password2"]', "newpassword123");
    await page.click('input[type="submit"]');

    // Should show error
    await expect(page.locator(".err")).toBeVisible();
  });
});
