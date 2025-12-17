/**
 * GraphQL API client fixture
 *
 * Provides a clean interface for making GraphQL calls from tests.
 * Handles JWT auth automatically from localStorage.
 */

import { Page } from "@playwright/test";

export class GraphQLClient {
  constructor(
    private page: Page,
    private baseUrl = "http://localhost:3000/graphql"
  ) {}

  /**
   * Execute a GraphQL query/mutation
   */
  async execute<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    options?: { skipAuth?: boolean }
  ): Promise<T> {
    const result = await this.page.evaluate(
      async ({ query, variables, baseUrl, skipAuth }) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (!skipAuth) {
          const creds = JSON.parse(localStorage.getItem("creds") || "{}");
          if (creds.jwt) {
            headers["Authorization"] = `Bearer ${creds.jwt}`;
          }
        }

        const response = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          return { error: `HTTP ${response.status}: ${await response.text()}` };
        }

        return response.json();
      },
      { query, variables, baseUrl: this.baseUrl, skipAuth: options?.skipAuth }
    );

    if (result.error) {
      throw new Error(result.error);
    }
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data as T;
  }

  // ============================================================================
  // Auth Operations
  // ============================================================================

  async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ userId: number }> {
    const data = await this.execute<{
      registerUser: { registerUserResult: { userId: number } };
    }>(
      `mutation Register($email: String!, $password: String!, $name: String!) {
        registerUser(input: { email: $email, password: $password, name: $name }) {
          registerUserResult { userId }
        }
      }`,
      { email, password, name },
      { skipAuth: true }
    );
    return data.registerUser.registerUserResult;
  }

  async login(email: string, password: string): Promise<string> {
    const data = await this.execute<{
      authenticateUser: { jwtToken: string };
    }>(
      `mutation Login($email: String!, $password: String!) {
        authenticateUser(input: { email: $email, password: $password }) {
          jwtToken
        }
      }`,
      { email, password },
      { skipAuth: true }
    );
    return data.authenticateUser.jwtToken;
  }

  // ============================================================================
  // Organization Operations
  // ============================================================================

  async createOrganization(
    slug: string,
    name: string
  ): Promise<{ id: number; slug: string; name: string }> {
    const data = await this.execute<{
      createOrganization: { organization: { id: number; slug: string; name: string } };
    }>(
      `mutation CreateOrganization($slug: String!, $name: String!) {
        createOrganization(input: { slug: $slug, name: $name }) {
          organization { id slug name }
        }
      }`,
      { slug, name }
    );
    return data.createOrganization.organization;
  }

  async updateOrganization(
    orgId: number,
    newName: string | null,
    newConfig: object | null = null
  ): Promise<{ id: number; name: string }> {
    const data = await this.execute<{
      updateOrganization: { organization: { id: number; name: string } };
    }>(
      `mutation UpdateOrganization($orgId: Int!, $newName: String, $newConfig: JSON) {
        updateOrganization(input: { orgId: $orgId, newName: $newName, newConfig: $newConfig }) {
          organization { id name config }
        }
      }`,
      { orgId, newName, newConfig }
    );
    return data.updateOrganization.organization;
  }

  async inviteToOrganization(
    orgId: number,
    email: string,
    role: string = "MEMBER"
  ): Promise<{ token: string }> {
    const data = await this.execute<{
      inviteToOrganization: { organizationInvite: { token: string } };
    }>(
      `mutation InviteToOrganization($orgId: Int!, $email: String!, $role: OrganizationRole!) {
        inviteToOrganization(input: { orgId: $orgId, inviteEmail: $email, inviteRole: $role }) {
          organizationInvite { token }
        }
      }`,
      { orgId, email, role }
    );
    return data.inviteToOrganization.organizationInvite;
  }

  async acceptOrganizationInvite(token: string): Promise<{ userId: number; role: string }> {
    const data = await this.execute<{
      acceptOrganizationInvite: { organizationMember: { userId: number; role: string } };
    }>(
      `mutation AcceptOrganizationInvite($token: String!) {
        acceptOrganizationInvite(input: { inviteToken: $token }) {
          organizationMember { userId role }
        }
      }`,
      { token }
    );
    return data.acceptOrganizationInvite.organizationMember;
  }

  async removeOrganizationMember(orgId: number, userId: number): Promise<boolean> {
    const data = await this.execute<{
      removeOrganizationMember: { boolean: boolean };
    }>(
      `mutation RemoveOrganizationMember($orgId: Int!, $userId: Int!) {
        removeOrganizationMember(input: { orgId: $orgId, memberUserId: $userId }) {
          boolean
        }
      }`,
      { orgId, userId }
    );
    return data.removeOrganizationMember.boolean;
  }

  async getMyOrganizations(): Promise<Array<{ id: number; slug: string; name: string }>> {
    const data = await this.execute<{
      myOrganizations: { nodes: Array<{ id: number; slug: string; name: string }> };
    }>(
      `query MyOrganizations {
        myOrganizations { nodes { id slug name } }
      }`
    );
    return data.myOrganizations.nodes;
  }

  // ============================================================================
  // Meeting Operations
  // ============================================================================

  async createMeeting(
    orgId: number,
    meetingId: string,
    title: string,
    config: object = {}
  ): Promise<{ id: string; title: string }> {
    const data = await this.execute<{
      createOrgMeeting: { meeting: { id: string; title: string } };
    }>(
      `mutation CreateOrgMeeting($orgId: Int!, $meetingId: String!, $title: String!, $config: JSON!) {
        createOrgMeeting(input: { orgId: $orgId, meetingId: $meetingId, meetingTitle: $title, meetingConfig: $config }) {
          meeting { id title }
        }
      }`,
      { orgId, meetingId, title, config }
    );
    return data.createOrgMeeting.meeting;
  }

  async updateMeeting(
    meetingId: string,
    newTitle: string | null,
    newConfig: object | null = null
  ): Promise<{ id: string; title: string }> {
    const data = await this.execute<{
      updateOrgMeeting: { meeting: { id: string; title: string } };
    }>(
      `mutation UpdateOrgMeeting($meetingId: String!, $newTitle: String, $newConfig: JSON) {
        updateOrgMeeting(input: { meetingId: $meetingId, newTitle: $newTitle, newConfig: $newConfig }) {
          meeting { id title config }
        }
      }`,
      { meetingId, newTitle, newConfig }
    );
    return data.updateOrgMeeting.meeting;
  }

  async deleteMeeting(meetingId: string): Promise<boolean> {
    const data = await this.execute<{
      deleteOrgMeeting: { boolean: boolean };
    }>(
      `mutation DeleteOrgMeeting($meetingId: String!) {
        deleteOrgMeeting(input: { meetingId: $meetingId }) {
          boolean
        }
      }`,
      { meetingId }
    );
    return data.deleteOrgMeeting.boolean;
  }

  // ============================================================================
  // Invite & Participant Operations
  // ============================================================================

  async createInviteCode(
    meetingId: string,
    maxUses: number | null = null,
    expiresAt: string | null = null
  ): Promise<{ id: number; code: string; maxUses: number | null; expiresAt: string | null }> {
    const data = await this.execute<{
      createInviteCode: {
        meetingInvite: { id: number; code: string; maxUses: number | null; expiresAt: string | null };
      };
    }>(
      `mutation CreateInviteCode($meetingId: String!, $maxUses: Int, $expiresAt: Datetime) {
        createInviteCode(input: { pMeetingId: $meetingId, pMaxUses: $maxUses, pExpiresAt: $expiresAt }) {
          meetingInvite { id code maxUses usesCount expiresAt }
        }
      }`,
      { meetingId, maxUses, expiresAt }
    );
    return data.createInviteCode.meetingInvite;
  }

  async validateInviteCode(
    code: string
  ): Promise<{ meetingId: string | null; meetingTitle: string | null; orgName: string | null; isValid: boolean }> {
    const data = await this.execute<{
      validateInviteCode: {
        inviteValidationResults: Array<{
          meetingId: string | null;
          meetingTitle: string | null;
          orgName: string | null;
          isValid: boolean;
        }>;
      };
    }>(
      `mutation ValidateInviteCode($code: String!) {
        validateInviteCode(input: { pCode: $code }) {
          inviteValidationResults { meetingId meetingTitle orgName isValid }
        }
      }`,
      { code },
      { skipAuth: true }
    );
    const results = data.validateInviteCode?.inviteValidationResults;
    if (!results || results.length === 0) {
      return { meetingId: null, meetingTitle: null, orgName: null, isValid: false };
    }
    return results[0];
  }

  async joinMeeting(
    meetingId: string,
    inviteCode: string,
    displayName: string
  ): Promise<{ id: number; displayName: string; participantNum: number }> {
    const data = await this.execute<{
      joinMeeting: {
        meetingParticipant: { id: number; displayName: string; participantNum: number };
      };
    }>(
      `mutation JoinMeeting($meetingId: String!, $inviteCode: String!, $displayName: String!) {
        joinMeeting(input: { pMeetingId: $meetingId, pInviteCode: $inviteCode, pDisplayName: $displayName }) {
          meetingParticipant { id displayName participantNum }
        }
      }`,
      { meetingId, inviteCode, displayName }
    );
    return data.joinMeeting.meetingParticipant;
  }

  async getMeetingToken(meetingId: string): Promise<string> {
    const data = await this.execute<{
      getMeetingToken: { jwtToken: string };
    }>(
      `mutation GetMeetingToken($meetingId: String!) {
        getMeetingToken(input: { pMeetingId: $meetingId }) {
          jwtToken
        }
      }`,
      { meetingId }
    );
    return data.getMeetingToken.jwtToken;
  }

  async getMeetingInvites(
    meetingId: string
  ): Promise<Array<{ id: number; code: string; maxUses: number | null; usesCount: number }>> {
    const data = await this.execute<{
      getMeetingInvites: {
        meetingInvites: Array<{ id: number; code: string; maxUses: number | null; usesCount: number }>;
      };
    }>(
      `mutation GetMeetingInvites($meetingId: String!) {
        getMeetingInvites(input: { pMeetingId: $meetingId }) {
          meetingInvites { id code maxUses usesCount expiresAt }
        }
      }`,
      { meetingId }
    );
    return data.getMeetingInvites.meetingInvites || [];
  }

  async deleteInviteCode(inviteId: number): Promise<boolean> {
    const data = await this.execute<{
      deleteInviteCode: { boolean: boolean };
    }>(
      `mutation DeleteInviteCode($inviteId: Int!) {
        deleteInviteCode(input: { pInviteId: $inviteId }) {
          boolean
        }
      }`,
      { inviteId }
    );
    return data.deleteInviteCode.boolean;
  }

  // ============================================================================
  // Sak Operations
  // ============================================================================

  async createSak(
    meetingId: string,
    title: string
  ): Promise<{ id: number; title: string }> {
    const data = await this.execute<{
      createSak: { sak: { id: number; title: string } };
    }>(
      `mutation CreateSak($meetingId: String!, $title: String!) {
        createSak(input: { sak: { meetingId: $meetingId, title: $title, config: {} } }) {
          sak { id title }
        }
      }`,
      { meetingId, title }
    );
    return data.createSak.sak;
  }
}

// ============================================================================
// JWT Helpers
// ============================================================================

export function decodeJwtClaims(jwt: string): {
  role: string;
  person_id: number;
  meeting_id: string;
  admin: boolean;
} {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
  return payload;
}

export async function setJwt(page: Page, jwt: string): Promise<void> {
  await page.evaluate((jwt) => {
    localStorage.setItem("creds", JSON.stringify({ jwt }));
  }, jwt);
}

export async function getJwt(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const creds = JSON.parse(localStorage.getItem("creds") || "{}");
    return creds.jwt || null;
  });
}

export async function clearJwt(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("creds");
  });
}
