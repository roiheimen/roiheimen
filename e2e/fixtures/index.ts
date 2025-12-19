/**
 * Main fixtures export
 *
 * Combines all fixtures for tests.
 * Server lifecycle is handled by Playwright's webServer config in playwright.config.ts.
 * Import { test, expect } from this file in all tests.
 */

import { test as base, mergeTests } from "@playwright/test";

import { authFixtures, AuthFixtures } from "./auth";
import { orgFixtures, OrgFixtures } from "./org";
import { meetingFixtures, MeetingFixtures } from "./meeting";

// Re-export everything tests might need
export { expect } from "@playwright/test";
export { GraphQLClient, setJwt, getJwt, clearJwt, decodeJwtClaims } from "./api";
export {
  query,
  queryRows,
  uniqueEmail,
  uniqueSlug,
  uniqueMeetingId,
  getUserId,
  getVerificationToken,
  getPasswordResetToken,
  isEmailVerified,
  getOrganization,
  getOrganizationMember,
  getMeeting,
  getInviteFromDb,
} from "./db";
export {
  createVerifiedUser,
  loginUser,
  createAndLoginUser,
  registerUserViaUI,
  loginUserViaUI,
  createVerifiedUserViaUI,
} from "./auth";
export type { UserCredentials, AuthenticatedUser } from "./auth";
export type { Organization, OrgOwnerFixture } from "./org";
export type {
  Meeting,
  MeetingInvite,
  Sak,
  MeetingAdminFixture,
  MeetingWithInviteFixture,
  MeetingWithSakFixture,
  ParticipantFixture,
} from "./meeting";

// ============================================================================
// Combined Fixtures
// ============================================================================

// Merge all fixtures together
// Note: mergeTests creates a new test function that includes all fixtures
type AllFixtures = AuthFixtures & OrgFixtures & MeetingFixtures;

export const test = mergeTests(authFixtures, orgFixtures, meetingFixtures) as ReturnType<
  typeof base.extend<AllFixtures>
>;
