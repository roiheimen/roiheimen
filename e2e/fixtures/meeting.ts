/**
 * Meeting fixtures
 *
 * Provides fixtures for meeting setup including invites and participants.
 */

import { test as base, Page } from "@playwright/test";
import { GraphQLClient, setJwt } from "./api";
import { uniqueSlug, uniqueMeetingId } from "./db";
import { AuthenticatedUser, createAndLoginUser } from "./auth";

export interface Organization {
  id: number;
  slug: string;
  name: string;
}

export interface Meeting {
  id: string;
  title: string;
}

export interface MeetingInvite {
  id: number;
  code: string;
  maxUses: number | null;
  expiresAt: string | null;
}

export interface Sak {
  id: number;
  title: string;
}

// ============================================================================
// Fixture Data Types
// ============================================================================

export interface MeetingAdminFixture {
  user: AuthenticatedUser;
  org: Organization;
  meeting: Meeting;
  meetingJwt: string;
  api: GraphQLClient;
}

export interface MeetingWithInviteFixture extends MeetingAdminFixture {
  invite: MeetingInvite;
}

export interface MeetingWithSakFixture extends MeetingWithInviteFixture {
  sak: Sak;
}

export interface ParticipantFixture {
  /** The admin/owner context */
  admin: MeetingWithSakFixture;
  /** The participant user */
  participant: AuthenticatedUser;
  /** Participant's meeting JWT */
  participantJwt: string;
  /** API client (uses participant auth) */
  api: GraphQLClient;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function setupMeetingAdmin(page: Page): Promise<MeetingAdminFixture> {
  const user = await createAndLoginUser(page, "MeetingAdmin");
  const api = new GraphQLClient(page);

  const slug = uniqueSlug();
  const org = await api.createOrganization(slug, "Test Org");

  const meetingId = uniqueMeetingId();
  const meeting = await api.createMeeting(org.id, meetingId, "Test Meeting");

  const meetingJwt = await api.getMeetingToken(meetingId);
  await setJwt(page, meetingJwt);

  return { user, org, meeting, meetingJwt, api };
}

async function setupMeetingWithInvite(page: Page): Promise<MeetingWithInviteFixture> {
  const base = await setupMeetingAdmin(page);
  const invite = await base.api.createInviteCode(base.meeting.id);
  return { ...base, invite };
}

async function setupMeetingWithSak(page: Page): Promise<MeetingWithSakFixture> {
  const base = await setupMeetingWithInvite(page);
  const sak = await base.api.createSak(base.meeting.id, "Sak 1: Test");
  return { ...base, sak };
}

// ============================================================================
// Fixture Definitions
// ============================================================================

export type MeetingFixtures = {
  /** Admin with org + meeting + meeting JWT set */
  meetingAdmin: MeetingAdminFixture;

  /** Admin with org + meeting + invite code */
  meetingWithInvite: MeetingWithInviteFixture;

  /** Admin with org + meeting + invite + sak (ready for speeches) */
  meetingWithSak: MeetingWithSakFixture;

  /** Full participant setup: admin context + joined participant */
  participantInMeeting: ParticipantFixture;
};

export const meetingFixtures = base.extend<MeetingFixtures>({
  meetingAdmin: async ({ page }, use) => {
    const fixture = await setupMeetingAdmin(page);
    await use(fixture);
  },

  meetingWithInvite: async ({ page }, use) => {
    const fixture = await setupMeetingWithInvite(page);
    await use(fixture);
  },

  meetingWithSak: async ({ page }, use) => {
    const fixture = await setupMeetingWithSak(page);
    await use(fixture);
  },

  participantInMeeting: async ({ page }, use) => {
    // Set up admin context
    const admin = await setupMeetingWithSak(page);

    // Create participant user
    const participant = await createAndLoginUser(page, "Participant");

    // Join meeting as participant
    const participantApi = new GraphQLClient(page);
    await participantApi.joinMeeting(admin.meeting.id, admin.invite.code, "Test Deltakar");

    // Get participant's meeting JWT
    const participantJwt = await participantApi.getMeetingToken(admin.meeting.id);
    await setJwt(page, participantJwt);

    await use({
      admin,
      participant,
      participantJwt,
      api: participantApi,
    });
  },
});
