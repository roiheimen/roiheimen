# Task: Implement Self-Serve SaaS Platform for Roiheimen

Transform Roiheimen from a closed meeting tool into a full self-serve SaaS platform where users can sign up, create organizations, manage meetings, and invite participants via codes.

## Requirements

Keep it simple.
There are some more fleshed-out docs in plans.ignore/01-self-serve.md.
You don't need to do a full phase in one go.

### Phase 1: User Accounts Foundation
- [x] Create `roiheimen.user_account` table (id, email, created_at, updated_at)
- [x] Create `roiheimen_private.user_credentials` table (user_id, password_hash, email_verified, failed_attempts, first_failed_at)
- [x] Create `roiheimen_private.email_verification` table (user_id, token, expires_at, used_at)
- [x] Create `roiheimen_private.password_reset` table (user_id, token, expires_at, used_at)
- [x] Create `roiheimen_private.user_session` table (user_id, login_at, logout_at)
- [x] Create new JWT type for user authentication
- [x] Implement `register_user(email, password, name)` function
- [x] Implement `verify_email(token)` function
- [x] Implement `authenticate_user(email, password)` function
  - [x] Brute force protection: lock after 3 failures in 5 min, reset on success
- [x] Implement `request_password_reset(email)` function
- [x] Implement `reset_password(token, new_password)` function
- [x] Create `pkg/server/email.js` with Nodemailer SMTP setup
  - [x] Dev mode: console.log email content with token instead of sending (no SMTP required)
- [x] Implement `sendVerificationEmail(email, token)` function
- [x] Implement `sendPasswordResetEmail(email, token)` function
- [x] Update `pkg/server/server.js` with email hooks and JWT config
- [x] Create `pkg/server/tasks/send_email.js` worker task for async email sending
- [x] Add database triggers to queue emails on user registration and password reset
- [x] Create `/registrer.html` signup page
- [x] Create `/stadfest-epost.html` email verification page
- [x] Create `/gløymt-passord.html` password reset request page
- [x] Create `/nullstill-passord.html` new password form page
- [x] Create `signup.js` component
- [x] Create `email-verify.js` component
- [x] Create `password-reset-request.js` component
- [x] Create `password-reset.js` component
- [x] Update `login.js` with email/password fields and links
- [x] Add userAuth Redux bundle to `state.js`
- [x] **Test**: Register new user, verify email token in DB
- [x] **Test**: Verify email flow (use token from DB or email)
- [x] **Test**: Login with verified user, confirm JWT returned
- [x] **Test**: Login with unverified user fails
- [x] **Test**: Account locks after 3 failed attempts, unlocks after 5 min
- [x] **Test**: Request password reset, verify token in DB
- [x] **Test**: Reset password with token, login with new password
- [ ] **Test**: The old 'voting' tests using the num/code test should still work, you must either
  rework the test (how it logs in), or make a way to use the old login in the app. Until the new
  system can also do the 'voting' test. (This has been postponed, because we can make the new user
  do the voting test later).

### Phase 2: Organizations
- [x] Create `roiheimen.organization` table (id, slug, name, config, created_at)
- [x] Create `roiheimen.organization_member` table (org_id, user_id, role, created_at)
- [x] Implement `create_organization(slug, name)` function
- [x] Implement `invite_to_organization(org_id, email, role)` function
- [x] Implement `update_organization(org_id, name, config)` function
- [x] Implement `remove_organization_member(org_id, user_id)` function
- [x] Implement `delete_organization(org_id)` function
- [x] Add RLS policies for organization tables
- [x] Create `/oversikt.html` dashboard page
- [x] Create `/org/ny.html` organization creation page
- [x] Create `dashboard.js` component
- [x] Create `org-card.js` component
- [x] Create `org-create.js` component
- [x] Create `org-settings.js` component
- [x] Create `org-members.js` component
- [x] Add organizations Redux bundle to `state.js`
- [x] **Test**: Create organization, verify owner membership
- [x] **Test**: Update organization name/config
- [x] **Test**: Invite member by email, verify pending invite
- [x] **Test**: RLS: non-member cannot see org data
- [x] **Test**: RLS: member can view, admin can edit
- [x] **Test**: Remove member, verify access revoked
- [x] **Test**: Dashboard shows user's organizations

### Phase 3: Meeting Creation
- [x] Add `organization_id` column to `meeting` table
- [x] Add `created_by` column to `meeting` table
- [x] Implement `create_meeting(org_id, id, title, config)` function
- [x] Implement `update_meeting(meeting_id, title, config)` function
- [x] Implement `delete_meeting(meeting_id)` function
- [x] Add RLS policies for meeting-org relationship
- [x] Create meeting creation wizard page (`/meeting/ny.html`)
- [x] Create `meeting-create.js` component (simple form, not multi-step wizard)
- [x] Create `meeting-card.js` component
- [x] Create `meeting-settings.js` component
- [x] Create `theme-picker.js` component
- [x] Update dashboard to show meetings grouped by organization
- [x] **Test**: Create meeting under organization
- [x] **Test**: Update meeting title/config
- [x] **Test**: RLS: only org members can see/edit meeting
- [x] **Test**: Delete meeting, verify cascade behavior
- [x] **Test**: Dashboard shows meetings per organization

### Phase 4: Invite System
- [x] Create `roiheimen.meeting_invite` table (id, meeting_id, code, max_uses, uses_count, expires_at, created_by, created_at)
- [x] Create `roiheimen.meeting_participant` table (id, meeting_id, user_id, display_name, participant_num, is_organizer, joined_via, created_at)
- [x] Create meeting-scoped JWT type (uses existing jwt_token type)
- [x] Implement `create_invite_code(meeting_id, max_uses, expires_at)` function
- [x] Implement `validate_invite_code(code)` function
- [x] Implement `join_meeting(meeting_id, invite_code, display_name)` function
- [x] Implement `get_meeting_token(meeting_id)` function
- [x] Implement `delete_invite_code(invite_id)` function
- [x] Implement `get_meeting_invites(meeting_id)` function
- [x] Implement `get_meeting_participants(meeting_id)` function
- [x] Add RLS policies for meeting_invite and meeting_participant tables
- [x] Create `/bli-med.html` invite code entry page
- [x] Create `/i/{code}` direct invite link landing page
- [x] Create `invite-generator.js` component
- [x] Create `invite-list.js` component
- [x] Create `join-meeting.js` component
- [x] Create `qr-code.js` component
- [ ] Update `manage.html` with "Invitasjonar" tab
- [ ] **Test**: Generate invite code, verify in DB
- [ ] **Test**: Join meeting via invite code
- [ ] **Test**: Join meeting via direct link /i/{code}
- [ ] **Test**: Invite with max_uses limit enforced
- [ ] **Test**: Expired invite code rejected
- [ ] **Test**: Meeting-scoped JWT grants queue.html access
- [ ] **Test**: QR code generates valid link

### Phase 5: Integration & Polish
- [ ] Update `queue.html` to work with new meeting_participant table
- [ ] Update `queue.html` to use meeting-scoped JWT
- [ ] Update `manage.html` with new tabs (Deltakarar, Saker, Avstemmingar, Invitasjonar)
- [ ] Update `manage.html` participant management to use meeting_participant
- [ ] Verify `gfx.html`, `screen.html`, `fullscreen.html` work with new tables
- [ ] Create global navigation component
- [ ] Add org switcher dropdown
- [ ] Add user menu (Profil, Logg ut)
- [ ] Add breadcrumb navigation
- [ ] Add activity feed on dashboard
- [ ] Update `index.html` to redirect to dashboard if logged in
- [ ] Remove legacy `person_account` table (after confirming no use)
- [ ] Remove legacy `authenticate(num, meeting_id, password)` function
- [ ] Clean up old person table columns
- [ ] Remove old login flow components
- [ ] Remove hostname-based meeting selection
- [ ] **Test E2E**: Register → verify email → create org → create meeting
- [ ] **Test E2E**: Generate invite → share link → participant joins
- [ ] **Test E2E**: Participant uses queue.html (add speech, vote)
- [ ] **Test E2E**: Admin uses manage.html (all tabs functional)
- [ ] **Test**: gfx.html displays speaker list correctly
- [ ] **Test**: screen.html shows votes/results
- [ ] **Test**: fullscreen.html works for audience display
- [ ] **Test**: Org switcher navigates between organizations
- [ ] **Test**: User menu logout clears session

## Technical Specifications

- **Database**: PostgreSQL with RLS (Row-Level Security) on all new tables
- **Backend**: PostGraphile GraphQL API with custom plugins for email hooks
- **Frontend**: Heresy + Redux Bundler (existing stack)
- **Email**: Nodemailer with SMTP configuration (dev mode: console.log instead of sending)
- **Authentication**: JWT tokens with 6-day expiry
- **Password hashing**: bcrypt via pgcrypto extension
- **Token generation**: `encode(gen_random_bytes(7), 'hex')` → 14-char hex
- **Migration files**: Place in `pkg/server/migrations/` directory
- **UI Language**: Norwegian Nynorsk (consistent with existing UI)

### Testing Approach
- **Automated e2e tests**: Run `yarn test:e2e` for Playwright tests (auto-starts servers with test DB)
  - Tests are in `e2e/tests/` - add new test files here
  - Use `yarn test:e2e:ui` for interactive Playwright UI
  - Use `yarn test:e2e:debug` for verbose debug output
- Use Chrome DevTools MCP for ad-hoc UI testing (navigate, click, fill, verify)
- Use `psql roiheimen_test` to verify database state (tokens, RLS policies)
- Run `./test-app.sh` to start server manually for dev/debugging
- Test credentials: In dev mode, tokens are printed to console; or check DB directly
- RLS tests: Connect as different roles to verify access control

### Environment Variables Required
```bash
# SMTP (only required in production - dev mode logs to console)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM="Roiheimen <noreply@example.com>"
APP_URL=https://roiheimen.example.com
```

### Key Files to Create
- `pkg/server/email.js` - SMTP email sending
- `pkg/server/migrations/014-user-accounts.sql`
- `pkg/server/migrations/015-organizations.sql`
- `pkg/server/migrations/016-meeting-orgs.sql`
- `pkg/server/migrations/017-invites.sql`
- Frontend pages and components as listed in requirements

### Key Files to Modify
- `pkg/server/db.sql` - Add new tables, functions, RLS
- `pkg/server/server.js` - Email hooks, JWT config
- `pkg/web/src/db/state.js` - Add userAuth, organizations, invites bundles
- `pkg/web/src/comp/login.js` - Email-based login
- `pkg/web/src/comp/manage.js` - Add invite tab, use new participant table
- `pkg/web/index.html` - Redirect to dashboard if logged in

## Success Criteria

- [ ] Users can register with email/password and receive verification email
- [ ] Users can log in after email verification
- [ ] Users can reset forgotten passwords via email
- [ ] Users can create organizations with unique slugs
- [ ] Organization owners can invite members by email
- [ ] Organization admins can manage member roles (owner, admin, member)
- [ ] Organization admins can create meetings with configuration wizard
- [ ] Meeting organizers can generate invite codes with optional limits and expiry
- [ ] Participants can join meetings via invite code or direct link
- [ ] QR codes can be generated for invite links
- [ ] Existing views (queue.html, manage.html, gfx.html, screen.html, fullscreen.html) work with new participant system
- [ ] Dashboard displays user's organizations and meetings
- [ ] Navigation includes org switcher and user menu
- [ ] Legacy authentication system is cleanly removed
- [ ] All database tables have proper RLS policies
- [ ] Email sending works reliably with configurable SMTP

## Progress

### Completed
- [x] Created structured PROMPT.md file from implementation plan
- [x] Created `pkg/server/migrations/014-user-accounts.sql` with:
  - All 5 tables (user_account, user_credentials, email_verification, password_reset, user_session)
  - JWT type `user_jwt_token` for user authentication
  - All auth functions (register_user, verify_email, authenticate_user, request_password_reset, reset_password)
  - Brute force protection (3 failures in 5 min locks account)
  - Helper functions (current_user_account, user_logout)
  - Role `roiheimen_user` with proper permissions
  - RLS policies for user_account table
  - Database triggers for queuing emails via graphile_worker
- [x] Created `pkg/server/email.js` with:
  - Nodemailer SMTP configuration (env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL)
  - Dev mode: logs emails to console instead of sending
  - `sendVerificationEmail(email, token, name)` - Norwegian Nynorsk email with verification link
  - `sendPasswordResetEmail(email, token)` - Norwegian Nynorsk email with reset link
  - HTML and plain text versions of all emails
- [x] Created `pkg/server/tasks/send_email.js`:
  - Graphile worker task for async email sending
  - Handles 'verification' and 'password_reset' email types
- [x] Updated `pkg/server/server.js`:
  - Added support for multiple JWT types (jwt_token and user_jwt_token)
- [x] Added nodemailer@6.9.0 dependency to package.json

- [x] Created `/stadfest-epost.html` and `email-verify.js` component:
  - Auto-verifies token from URL query parameter (?token=xxx)
  - Shows success/error states with appropriate Norwegian messages
- [x] Created `/gloeymt-passord.html` and `password-reset-request.js` component:
  - Email input form that requests password reset
  - Always shows success to prevent email enumeration
- [x] Created `/nullstill-passord.html` and `password-reset.js` component:
  - New password form with confirmation
  - Validates token from URL and enforces 8-char minimum

### In Progress
- [ ] Phase 4: Invite System - QR code component complete, manage.html tab next

### Completed This Iteration (QR Code Component)
- [x] Created `qr-code.js` component with:
  - Pure client-side QR code generation using canvas
  - Custom QR Code class implementing Reed-Solomon error correction
  - Supports version 1-8 QR codes (up to ~150 chars)
  - Download QR code as PNG functionality
  - Norwegian Nynorsk UI text
- [x] Updated `invite-generator.js` to show QR code toggle on success screen:
  - "Vis QR-kode" / "Gøym QR-kode" toggle button
  - QR code renders the invite link
- [x] Updated `invite-list.js` with QR code modal:
  - Added "QR" button for each invite code in the list
  - Modal overlay displays QR code with invite link
  - Click outside or X button closes modal

### Completed Previous Iteration (Invite Generator & List Components)
- [x] Created `invite-generator.js` component with:
  - Form to create invite codes with optional max uses and expiry date
  - Success screen displaying the generated code and direct link
  - Copy to clipboard functionality for code and link
  - Event emission for parent component refresh
  - Norwegian Nynorsk UI text
- [x] Created `invite-list.js` component with:
  - Fetches and displays all invites for a meeting via `getMeetingInvites`
  - Shows invite code, status, usage, expiry, and creation date
  - Status badges (Active, Expired, Exhausted)
  - Copy buttons for code and link
  - Delete functionality with confirmation
  - Auto-refresh when new invite is created

### Completed Previous Iteration (Join Meeting UI)
- [x] Created `/bli-med.html` invite code entry page
- [x] Created `join-meeting.js` component with:
  - Invite code entry form with validation
  - Auto-validation of code from URL parameter (?code=XXX)
  - Meeting info display (title, organization name)
  - Display name entry for joining
  - Login redirect for unauthenticated users
  - Success screen with link to queue.html
  - Norwegian Nynorsk UI text and error messages
- [x] Added `/i/{code}` route middleware to `es-dev-server.config.js`:
  - Redirects `/i/XXXXXXXX` to `/bli-med.html?code=XXXXXXXX`
  - Enables shareable invite links

### Previous Session (Meeting Invite System - Database Schema)
- [x] Created `roiheimen.meeting_invite` table with:
  - id, meeting_id, code, max_uses, uses_count, expires_at, created_by, created_at
  - Unique code index
  - FK to meeting and user_account tables
- [x] Created `roiheimen.meeting_participant` table with:
  - id, meeting_id, user_id, display_name, participant_num, is_organizer, joined_via, created_at
  - Unique constraints on (meeting_id, user_id) and (meeting_id, participant_num)
  - FK to meeting, user_account, and meeting_invite tables
- [x] Implemented invite functions:
  - `create_invite_code(meeting_id, max_uses, expires_at)` - generates 8-char unique codes
  - `validate_invite_code(code)` - validates code and returns meeting info
  - `join_meeting(meeting_id, invite_code, display_name)` - joins user as participant
  - `get_meeting_token(meeting_id)` - returns meeting-scoped JWT
  - `delete_invite_code(invite_id)` - deletes an invite code
  - `get_meeting_invites(meeting_id)` - lists all invites for a meeting
  - `get_meeting_participants(meeting_id)` - lists all participants
- [x] Added RLS policies for both tables:
  - Org admins/owners can manage invites
  - Participants and org members can view participants
  - Users can add themselves as participants via join_meeting
- [x] Created migration file `pkg/server/migrations/018-meeting-invites.sql`
- [x] Updated `pkg/server/db.sql` with all new tables, functions, permissions, and RLS

### Previous Session (Meeting Settings & Theme Picker)
- [x] Created `meeting-settings.js` component with:
  - Edit meeting title
  - Display meeting URLs (queue, manage, gfx, screen, fullscreen)
  - Speaker list settings (speechDisabled, speechInnleggDisabled)
  - Voting settings (hideClosedReferendumResults, gfxIframeOnQueue, stableChoices)
  - YouTube video ID configuration
  - External CSS URL configuration
  - Delete meeting functionality (owner only)
  - Role-based permissions (admin/owner can edit)
- [x] Created `meeting-settings-page.js` wrapper component:
  - Loads meeting and organization data from URL parameter
  - Navigation between settings and admin panel
- [x] Created `/mote-innstillingar.html` page
- [x] Created `theme-picker.js` component with:
  - Color inputs for main theme colors (mainColor, mainColor2, fontColor, videoBg)
  - Font configuration (font, headFont)
  - Size configuration (headSize, voteHeaderSize, voteFontSize)
  - Live preview of colors
  - Reset to defaults functionality
  - Collapsible UI to save space
- [x] Updated `meeting-card.js` to link to settings page
- [x] Integrated theme-picker into meeting-settings form

### Previous Session (Meeting Creation UI & Tests)
- [x] Created `meeting-create.js` component with:
  - Organization lookup from URL query parameter
  - Auto-generates meeting ID from title (Norwegian-friendly)
  - Validates meeting ID format (lowercase, numbers, hyphens)
  - Creates meeting via `createOrgMeeting` GraphQL mutation
  - Success screen with links to admin panel and dashboard
- [x] Created `/meeting/ny.html` page
- [x] Fixed function naming conflicts with PostGraphile:
  - Renamed `create_meeting` → `create_org_meeting`
  - Renamed `update_meeting` → `update_org_meeting`
  - Renamed `delete_meeting` → `delete_org_meeting`
  - Renamed `organization_meetings` field to `organizationMeetings` via smart comment
- [x] Fixed RLS policies for meeting table:
  - Legacy meetings (no org_id) visible to legacy auth roles
  - Org meetings only visible to org members
  - Fixed infinite recursion in organization_member RLS policy
  - Added `user_is_org_member` helper function in roiheimen_private schema
- [x] Added comprehensive E2E tests (11 new tests, all passing):
  - Meeting Creation: create, unique ID, non-member blocked, member blocked
  - Meeting Update: title update, config update
  - Meeting Delete: owner can delete, non-admin blocked
  - Meeting RLS: non-member cannot see, member can see
  - Dashboard: shows meetings per organization

### Previous Session (Meeting UI Components)
- [x] Created `meeting-card.js` component with:
  - Display for meeting title, ID, creation date
  - Sak (agenda item) count
  - Links to meeting settings and admin panel
  - Consistent styling with org-card component
- [x] Updated `dashboard.js` to show meetings grouped by organization:
  - Each organization section shows its meetings in a grid
  - "Nytt mote" (new meeting) button for admins/owners
  - GraphQL query includes organizationMeetings with saks count

### Previous Session (Meeting-Org Schema)
- [x] Created migration `017-meeting-organization.sql` with:
  - `organization_id` column on `meeting` table (FK to `organization`)
  - `created_by` column on `meeting` table (FK to `user_account`)
  - Indexes for both new columns
  - `create_meeting(org_id, meeting_id, meeting_title, meeting_config)` function
  - `update_meeting(meeting_id, new_title, new_config)` function
  - `delete_meeting(meeting_id)` function
  - `organization_meetings(org)` function to get meetings for an org
  - RLS policies: select_meeting_org, insert_meeting_org, update_meeting_org, delete_meeting_org
  - Permission grants for roiheimen_user role
- [x] Updated `pkg/server/db.sql` with same schema changes

### Previous Session (RLS Tests)
- [x] Fixed organization tests - all 14 tests now pass
- [x] Fixed `createVerifiedUser` helper to use `page.route()` interception to prevent
  redirect issues caused by old meeting-based auth system
- [x] Fixed `expect().rejects.toThrow()` usage - replaced with try/catch pattern
  compatible with Playwright
- [x] Updated slug validation test to match actual database behavior (normalizes
  to lowercase, rejects invalid characters and length violations)
- [x] All RLS tests now passing:
  - non-member cannot see org data
  - member can view, admin can edit
  - Remove member, verify access revoked
- [x] All 26 tests pass (14 organization + 12 user-auth)

### Previous Session (Completed This Session)
- [x] Added organizations Redux bundle to `state.js` with:
  - Actions: doOrganizationsFetch, doOrganizationCreate, doOrganizationUpdate, doOrganizationDelete, doOrganizationInvite, doOrganizationRemoveMember
  - Selectors: selectOrganizations, selectOrganizationsFetched, selectOrganizationsFetching, selectOrganizationsError, selectOrganizationBySlug, selectOrganizationById
  - Reactor: reactOrganizationsFetch - auto-fetches organizations when user is logged in
  - State management: creating, updating, deleting flags for loading states
  - Integration: Clears organization data on USER_AUTH_LOGOUT
- [x] Created `org-members.js` component with:
  - Member list with name, email, role badges
  - Invite form for admins/owners
  - Remove member functionality with confirmation
  - Pending invites display
  - Role-based permissions (owner can invite any role, admin can only invite members)
- [x] Created `org-members-page.js` wrapper component
- [x] Created `/org-medlemer.html` page
- [x] Created `pkg/server/migrations/016-org-members-view.sql` with:
  - `get_organization_members(org_id)` function returning member info with user data
  - `organization_member_info` composite type
  - RLS policy `select_org_member_user_account` to allow viewing fellow org members' user_account data
- [x] Updated `pkg/server/db.sql` with the same function, type, and RLS policy

### Previous Session (org-settings)
- [x] Created `org-settings.js` component with:
  - Organization name editing (admin/owner only)
  - Read-only slug display
  - Save changes functionality with GraphQL mutation
  - Danger zone with delete organization (owner only)
  - Proper Norwegian Nynorsk UI text
- [x] Created `org-settings-page.js` wrapper component that:
  - Loads organization by slug from query parameter
  - Handles loading/error states
  - Provides navigation between org pages
- [x] Created `/org-innstillingar.html` page
- [x] Updated `org-card.js` to link to the new settings page

### Previous Session (org-card)
- [x] Created `org-card.js` component showing org name, slug, role badge (eigar/admin/medlem) and meeting count
- [x] Updated `dashboard.js` to use the new org-card component
- [x] Updated dashboard GraphQL query to fetch `myRoleInOrganization` field
- [x] Tests verified: dashboard shows user's organizations, update org name/config, invite member by email

### Previous Session (continued)
- [x] Created `roiheimen.organization` table with slug, name, config
- [x] Created `roiheimen.organization_member` table with role enum (owner, admin, member)
- [x] Created `roiheimen.organization_invite` table for pending email invites
- [x] Implemented `create_organization(slug, name)` function - creates org and adds creator as owner
- [x] Implemented `update_organization(org_id, new_name, new_config)` function - admin/owner only
- [x] Implemented `invite_to_organization(org_id, email, role)` function - generates invite token
- [x] Implemented `accept_organization_invite(token)` function - joins user to org
- [x] Implemented `remove_organization_member(org_id, user_id)` function - with role-based permissions
- [x] Implemented `delete_organization(org_id)` function - owner only
- [x] Implemented `my_organizations()` function - lists current user's orgs
- [x] Implemented `get_organization_by_slug(slug)` function - renamed to avoid PostGraphile conflict
- [x] Implemented `my_role_in_organization(org)` function - returns user's role
- [x] Added RLS policies for organization, organization_member, organization_invite tables
- [x] Added permissions grants for roiheimen_user role
- [x] Created `pkg/server/migrations/015-organizations.sql` migration file
- [x] Created `/oversikt.html` dashboard page
- [x] Created `comp/dashboard.js` component with organization list
- [x] Created `e2e/tests/organizations.spec.ts` test file with organization tests
- [x] First organization test (create + verify owner) passing
- [x] All 12 Phase 1 auth tests still passing

### Previous Session
- [x] Created `e2e/tests/user-auth.spec.ts` with 12 comprehensive tests
- [x] Fixed `login.js` GraphQL mutation to use correct field name `jwtToken`
- [x] Fixed `password-reset-request.js` GraphQL mutation
- [x] Fixed `graphql.js` error handling

### Next Steps
1. Complete Phase 3: Meeting Creation
   - Create `meeting-settings.js` component
   - Create `theme-picker.js` component
2. Begin Phase 4: Invite System
   - Create meeting invite tables
   - Implement invite code generation and validation
3. Integration & Polish (Phase 5)
