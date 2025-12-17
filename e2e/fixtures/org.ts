/**
 * Organization fixtures
 *
 * Provides fixtures for organization setup and management.
 */

import { test as base } from "@playwright/test";
import { GraphQLClient } from "./api";
import { uniqueSlug } from "./db";
import { AuthenticatedUser, createAndLoginUser } from "./auth";

export interface Organization {
  id: number;
  slug: string;
  name: string;
}

export interface OrgOwnerFixture {
  user: AuthenticatedUser;
  org: Organization;
  api: GraphQLClient;
}

export type OrgFixtures = {
  /** A user who owns an organization (user + org created fresh) */
  orgOwner: OrgOwnerFixture;
};

/**
 * Organization fixtures to extend test with
 */
export const orgFixtures = base.extend<OrgFixtures>({
  orgOwner: async ({ page }, use) => {
    // Create and login user
    const user = await createAndLoginUser(page, "OrgOwner");

    // Create organization
    const api = new GraphQLClient(page);
    const slug = uniqueSlug();
    const org = await api.createOrganization(slug, "Test Organisasjon");

    await use({ user, org, api });
  },
});
