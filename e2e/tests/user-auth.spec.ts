/**
 * User Authentication Tests
 *
 * Tests the full user authentication flow including:
 * - Registration (UI flow - tests the actual UI)
 * - Email verification
 * - Login
 * - Brute force protection
 * - Password reset
 *
 * These tests intentionally use the UI for registration/login
 * since they're testing those specific flows.
 */

import { test, expect } from "../fixtures";
import {
  query,
  uniqueEmail,
  registerUser,
  getVerificationToken,
  getPasswordResetToken,
  isEmailVerified,
  getFailedAttempts,
} from "../helpers";

test.describe("User Registration", () => {
  test("registration flow", async ({ page }) => {
    await test.step("can register new user and verification token is created in DB", async () => {
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

    await test.step("registration fails with weak password", async () => {
      await page.goto("/registrer.html");
      await page.waitForSelector("roi-signup");

      await page.fill('input[name="name"]', "Test Brukar");
      await page.fill('input[name="email"]', uniqueEmail());
      await page.fill('input[name="password"]', "1234567"); // 7 chars - under minimum
      await page.fill('input[name="password2"]', "1234567");

      // Remove minlength attribute to bypass HTML5 validation
      await page.evaluate(() => {
        const inputs = document.querySelectorAll("input[minlength]");
        inputs.forEach((input) => input.removeAttribute("minlength"));
      });

      await page.click('input[type="submit"]');

      await expect(page.locator(".err")).toContainText("minst 8 teikn");
    });

    await test.step("registration fails with mismatched passwords", async () => {
      await page.goto("/registrer.html");
      await page.waitForSelector("roi-signup");

      await page.fill('input[name="name"]', "Test Brukar");
      await page.fill('input[name="email"]', uniqueEmail());
      await page.fill('input[name="password"]', "testpassord123");
      await page.fill('input[name="password2"]', "testpassord456");

      await page.click('input[type="submit"]');

      await expect(page.locator(".err")).toContainText("ikkje like");
    });
  });
});

test.describe("Email Verification", () => {
  test("verification flow", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    await test.step("register user for verification test", async () => {
      await registerUser(page, name, email, password);
    });

    await test.step("can verify email using token from DB", async () => {
      const token = await getVerificationToken(email);
      expect(token).toBeTruthy();

      await page.goto(`/stadfest-epost.html?token=${token}`);

      await page.waitForSelector(".success", { timeout: 10000 });
      await expect(page.locator(".success")).toContainText("stadfesta");

      const verified = await isEmailVerified(email);
      expect(verified).toBe(true);
    });

    await test.step("verification fails with invalid token", async () => {
      await page.goto("/stadfest-epost.html?token=invalidtoken123");

      await page.waitForSelector(".error", { timeout: 10000 });
      await expect(page.locator(".error")).toBeVisible();
    });
  });
});

test.describe("User Login", () => {
  test("login flow", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    await test.step("register and verify user", async () => {
      await registerUser(page, name, email, password);
      const token = await getVerificationToken(email);
      await page.goto(`/stadfest-epost.html?token=${token}`);
      await page.waitForSelector(".success");
    });

    await test.step("verified user can login and receives JWT", async () => {
      await page.goto("/login.html");
      await page.waitForSelector("roi-login");

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);

      await Promise.all([
        page.waitForURL("**/oversikt.html", { timeout: 10000 }),
        page.click('input[type="submit"]'),
      ]);

      const jwt = await page.evaluate(() => {
        const creds = JSON.parse(localStorage.getItem("creds") || "{}");
        return creds.jwt;
      });
      expect(jwt).toBeTruthy();
    });
  });

  test("unverified user cannot login", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    await registerUser(page, name, email, password);

    await page.goto("/login.html");
    await page.waitForSelector("roi-login");

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    await page.click('input[type="submit"]');

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

    await expect(page.locator(".err")).toBeVisible();
  });
});

test.describe("Brute Force Protection", () => {
  test("account locks after 3 failed attempts", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const password = "testpassord123";

    await test.step("register and verify user", async () => {
      await registerUser(page, name, email, password);
      const token = await getVerificationToken(email);
      await page.goto(`/stadfest-epost.html?token=${token}`);
      await page.waitForSelector(".success");
    });

    await test.step("attempt login with wrong password 3 times", async () => {
      for (let i = 0; i < 3; i++) {
        await page.goto("/login.html");
        await page.waitForSelector("roi-login");

        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', "wrongpassword");

        await page.click('input[type="submit"]');

        await page.waitForSelector(".err");
      }
    });

    await test.step("verify account is locked", async () => {
      const attempts = await getFailedAttempts(email);
      expect(attempts).toBeGreaterThanOrEqual(3);

      // Try to login with correct password - should be locked
      await page.goto("/login.html");
      await page.waitForSelector("roi-login");

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);

      await page.click('input[type="submit"]');

      await expect(page.locator(".err")).toContainText("låst");
    });
  });
});

test.describe("Password Reset", () => {
  test("password reset flow", async ({ page }) => {
    const email = uniqueEmail();
    const name = "Test Brukar";
    const oldPassword = "testpassord123";
    const newPassword = "nyttpassord456";

    await test.step("register and verify user", async () => {
      await registerUser(page, name, email, oldPassword);
      const verifyToken = await getVerificationToken(email);
      await page.goto(`/stadfest-epost.html?token=${verifyToken}`);
      await page.waitForSelector(".success");
    });

    await test.step("can request password reset and token is created in DB", async () => {
      await page.goto("/gloeymt-passord.html");
      await page.waitForSelector("roi-password-reset-request");

      await page.fill('input[name="email"]', email);
      await page.click('input[type="submit"]');

      await page.waitForSelector(".success", { timeout: 10000 });

      const resetToken = await getPasswordResetToken(email);
      expect(resetToken).toBeTruthy();
      expect(resetToken!.length).toBe(14);
    });

    await test.step("can reset password with token and login with new password", async () => {
      const resetToken = await getPasswordResetToken(email);
      expect(resetToken).toBeTruthy();

      await page.goto(`/nullstill-passord.html?token=${resetToken}`);
      await page.waitForSelector("roi-password-reset");

      await page.fill('input[name="password"]', newPassword);
      await page.fill('input[name="password2"]', newPassword);
      await page.click('input[type="submit"]');

      await page.waitForSelector(".success", { timeout: 10000 });

      // Login with new password
      await page.goto("/login.html");
      await page.waitForSelector("roi-login");

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', newPassword);

      await Promise.all([
        page.waitForURL("**/oversikt.html", { timeout: 10000 }),
        page.click('input[type="submit"]'),
      ]);

      const jwt = await page.evaluate(() => {
        const creds = JSON.parse(localStorage.getItem("creds") || "{}");
        return creds.jwt;
      });
      expect(jwt).toBeTruthy();
    });
  });

  test("password reset fails with invalid token", async ({ page }) => {
    await page.goto("/nullstill-passord.html?token=invalidtoken123");
    await page.waitForSelector("roi-password-reset");

    await page.fill('input[name="password"]', "newpassword123");
    await page.fill('input[name="password2"]', "newpassword123");
    await page.click('input[type="submit"]');

    await expect(page.locator(".err")).toBeVisible();
  });
});
