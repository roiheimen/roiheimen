
-- Permissions

alter default privileges revoke execute on functions from public;

-- Create role for authenticated users (email-based)
do $$
begin
  if not exists (select from pg_roles where rolname = 'roiheimen_user') then
    create role roiheimen_user;
  end if;
end
$$;

grant roiheimen_anonymous to roiheimen_postgraphile;
grant roiheimen_person to roiheimen_postgraphile;
grant roiheimen_user to roiheimen_postgraphile;
grant usage on schema roiheimen to roiheimen_anonymous, roiheimen_person, roiheimen_user;

grant select on table roiheimen.meeting to roiheimen_anonymous, roiheimen_person;
grant insert, update on table roiheimen.meeting to roiheimen_person;

grant select on table roiheimen.sak to roiheimen_anonymous, roiheimen_person;
grant insert, update, delete on table roiheimen.sak to roiheimen_person;
grant usage on sequence roiheimen.sak_id_seq to roiheimen_person;

grant select on table roiheimen.person to roiheimen_anonymous, roiheimen_person;
grant update, delete on table roiheimen.person to roiheimen_person;

grant select on table roiheimen.speech to roiheimen_anonymous, roiheimen_person;
grant insert, update, delete on table roiheimen.speech to roiheimen_person;
grant usage on sequence roiheimen.speech_id_seq to roiheimen_person;

grant select, insert, update, delete on table roiheimen.test to roiheimen_person;
grant usage on sequence roiheimen.test_id_seq to roiheimen_person;

grant select on table roiheimen.referendum to roiheimen_anonymous, roiheimen_person;
grant insert, update, delete on table roiheimen.referendum to roiheimen_person;
grant usage on sequence roiheimen.referendum_id_seq to roiheimen_person;
grant select, update, insert, delete on table roiheimen.vote to roiheimen_person;
grant usage on sequence roiheimen.vote_id_seq to roiheimen_person;

grant select on roiheimen.ordered_speech to roiheimen_anonymous, roiheimen_person;

grant execute on function roiheimen.latest_sak(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_speech(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_person() to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_participant() to roiheimen_person, roiheimen_user;
grant execute on function roiheimen.vote_count(integer) to roiheimen_person;
grant execute on function roiheimen.stats_people_meeting(text) to roiheimen_person;

-- User account table permissions
-- Anonymous and person can SELECT (RLS ensures they only see their own record if logged in)
grant select on table roiheimen.user_account to roiheimen_anonymous, roiheimen_person, roiheimen_user;
grant update on table roiheimen.user_account to roiheimen_user;

-- User account function permissions (anonymous can register/login/reset password)
grant execute on function roiheimen.register_user(text, text, text) to roiheimen_anonymous;
grant execute on function roiheimen.verify_email(text) to roiheimen_anonymous;
grant execute on function roiheimen.authenticate_user(text, text) to roiheimen_anonymous;
grant execute on function roiheimen.request_password_reset(text) to roiheimen_anonymous;
grant execute on function roiheimen.reset_password(text, text) to roiheimen_anonymous;

-- Authenticated user functions (anonymous/person can call but RLS returns empty)
grant execute on function roiheimen.current_user_account() to roiheimen_anonymous, roiheimen_person, roiheimen_user;
grant execute on function roiheimen.user_logout() to roiheimen_user;

-- Organization table permissions
grant select on table roiheimen.organization to roiheimen_user;
grant select on table roiheimen.organization_member to roiheimen_user;
grant select on table roiheimen.organization_invite to roiheimen_user;
grant usage on sequence roiheimen.organization_id_seq to roiheimen_user;
grant usage on sequence roiheimen.organization_member_id_seq to roiheimen_user;
grant usage on sequence roiheimen.organization_invite_id_seq to roiheimen_user;

-- Organization function permissions
grant execute on function roiheimen.create_organization(text, text) to roiheimen_user;
grant execute on function roiheimen.update_organization(integer, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.invite_to_organization(integer, text, roiheimen.organization_role) to roiheimen_user;
grant execute on function roiheimen.accept_organization_invite(text) to roiheimen_user;
grant execute on function roiheimen.remove_organization_member(integer, integer) to roiheimen_user;
grant execute on function roiheimen.delete_organization(integer) to roiheimen_user;
grant execute on function roiheimen.my_organizations() to roiheimen_user;
grant execute on function roiheimen.get_organization_by_slug(text) to roiheimen_user;
grant execute on function roiheimen.organization_my_role(roiheimen.organization) to roiheimen_user;
grant execute on function roiheimen.get_organization_members(integer) to roiheimen_user;

-- Meeting table permissions for roiheimen_user
grant select on table roiheimen.meeting to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting to roiheimen_user;

-- Meeting function permissions
grant execute on function roiheimen.create_org_meeting(integer, text, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.update_org_meeting(text, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.delete_org_meeting(text) to roiheimen_user;
grant execute on function roiheimen.organization_meetings(roiheimen.organization) to roiheimen_user;

-- Meeting invite table permissions
grant select on table roiheimen.meeting_invite to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting_invite to roiheimen_user;
grant usage on sequence roiheimen.meeting_invite_id_seq to roiheimen_user;

-- Meeting participant table permissions
grant select on table roiheimen.meeting_participant to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting_participant to roiheimen_user;
grant usage on sequence roiheimen.meeting_participant_id_seq to roiheimen_user;

-- Meeting invite function permissions
grant execute on function roiheimen.create_invite_code(text, integer, timestamptz) to roiheimen_user;
grant usage on type roiheimen.invite_validation_result to roiheimen_anonymous, roiheimen_user;
grant execute on function roiheimen.validate_invite_code(text) to roiheimen_anonymous, roiheimen_user;
grant execute on function roiheimen.join_meeting(text, text, text) to roiheimen_user;
grant execute on function roiheimen.get_meeting_token(text) to roiheimen_user;
grant execute on function roiheimen.delete_invite_code(integer) to roiheimen_user;
grant execute on function roiheimen.get_meeting_invites(text) to roiheimen_user;
grant execute on function roiheimen.get_meeting_participants(text) to roiheimen_user;

-- Activity feed permissions
grant usage on type roiheimen.activity_item to roiheimen_user;
grant execute on function roiheimen.get_user_activity(integer) to roiheimen_user;

-- Row lewel security policy
alter table roiheimen.meeting enable row level security;
alter table roiheimen.sak enable row level security;
alter table roiheimen.person enable row level security;
alter table roiheimen.speech enable row level security;
alter table roiheimen.test enable row level security;
alter table roiheimen.referendum enable row level security;
alter table roiheimen.vote enable row level security;

-- Legacy meeting policy: anyone can see meetings without an organization_id
-- (for backward compatibility with legacy meeting-based auth)
create policy select_meeting_legacy on roiheimen.meeting
  for select to roiheimen_anonymous, roiheimen_person
  using (organization_id is null);

-- Allow roiheimen_person to see their current meeting (derived from person record)
-- This enables participants with meeting tokens to access meeting data for voting/speech
create policy select_meeting_participant on roiheimen.meeting
  for select to roiheimen_person
  using (id = roiheimen_private.current_meeting_id());

-- Meeting RLS policies for organization-based access (roiheimen_user role)
-- Select: org members can view meetings in their orgs
-- Also allow viewing legacy meetings (org_id is null)
-- Uses helper function to avoid RLS recursion with organization_member table
create policy select_meeting_org on roiheimen.meeting
  for select to roiheimen_user
  using (
    organization_id is null  -- Legacy meetings visible to authenticated users
    OR (organization_id is not null and exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = roiheimen.meeting.organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    ))
  );

-- Insert: org admins/owners can insert meetings
create policy insert_meeting_org on roiheimen.meeting
  for insert to roiheimen_user
  with check (
    organization_id is not null and exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = roiheimen.meeting.organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Update: org admins/owners can update meetings
create policy update_meeting_org on roiheimen.meeting
  for update to roiheimen_user
  using (
    organization_id is not null and exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = roiheimen.meeting.organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Delete: org owners can delete meetings
create policy delete_meeting_org on roiheimen.meeting
  for delete to roiheimen_user
  using (
    organization_id is not null and exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = roiheimen.meeting.organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role = 'owner'
    )
  );

create policy select_sak on roiheimen.sak for select using (
    meeting_id = roiheimen_private.current_meeting_id()
  );
create policy update_sak on roiheimen.sak for all using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = roiheimen_private.current_meeting_id()
  );

create policy select_person on roiheimen.person for select using (true);
create policy update_person on roiheimen.person for update to roiheimen_person
  using (id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_person on roiheimen.person for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = roiheimen_private.current_meeting_id()
  );

create policy select_speech on roiheimen.speech for select using (true);
create policy insert_speech on roiheimen.speech for insert to roiheimen_person
  with check (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy update_speech on roiheimen.speech for update to roiheimen_person
  using (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy delete_speech on roiheimen.speech for delete to roiheimen_person
  using (speaker_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_speech on roiheimen.speech for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and exists (
      select 1 from roiheimen.person
      where id = speaker_id
      and meeting_id = roiheimen_private.current_meeting_id()
    )
  );

create policy all_test on roiheimen.test for all to roiheimen_person
  using (requester_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_test on roiheimen.test for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and exists (
      select 1 from roiheimen.person
      where id = requester_id
      and meeting_id = roiheimen_private.current_meeting_id()
    )
  );

create policy select_referendum on roiheimen.referendum for select using (true);
create policy update_referendum on roiheimen.referendum for all using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and exists (
      select 1 from roiheimen.sak
      where id = sak_id
      and meeting_id = roiheimen_private.current_meeting_id()
    )
  );
create policy select_vote on roiheimen.vote for select to roiheimen_person
  using (
    exists (
      select 1 from roiheimen.referendum
      where id = referendum_id
      and sak_id = sak_id
      and type = 'open'
      -- and sak meeting id?
    )
    and exists (
      select 1 from roiheimen.person
      where id = person_id
      and meeting_id = roiheimen_private.current_meeting_id()
    )
  );
-- Actually not a good idea, since admins will have access to users pws,
-- and can therefore read their votes
create policy select_vote_yourself on roiheimen.vote for select to roiheimen_person
  using (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
  );
create policy insert_vote on roiheimen.vote for insert to roiheimen_person
  with check (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
    and exists (
      select 1 from roiheimen.referendum r
      join roiheimen.sak s on (s.id = r.sak_id)
      join roiheimen.meeting m on (m.id = s.meeting_id)
      where r.id = referendum_id
        and r.finished_at is null
        and not ((m.config || s.config || '{"voteDisallowNum":[]}')->'voteDisallowNum') @> (
            select num::text::jsonb from roiheimen.person
            where id = person_id
        )
    )
  );
create policy update_vote on roiheimen.vote for update to roiheimen_person
  using (
    person_id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
    and
    exists (
      -- No need to check voteDisallow on update, since insert was allowed
      select from roiheimen.referendum r
      where r.id = referendum_id
        and r.finished_at is null
    )
  );

-- User account RLS
alter table roiheimen.user_account enable row level security;

create policy select_own_user_account on roiheimen.user_account
  for select to roiheimen_user
  using (id = nullif(current_setting('jwt.claims.user_id', true), '')::integer);

create policy update_own_user_account on roiheimen.user_account
  for update to roiheimen_user
  using (id = nullif(current_setting('jwt.claims.user_id', true), '')::integer);

-- Allow viewing user_account of fellow org members
create policy select_org_member_user_account on roiheimen.user_account
  for select to roiheimen_user
  using (
    exists (
      select 1
      from roiheimen.organization_member om_self
      join roiheimen.organization_member om_target on om_target.organization_id = om_self.organization_id
      where om_self.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om_target.user_id = roiheimen.user_account.id
    )
  );

-- Organization RLS
alter table roiheimen.organization enable row level security;
alter table roiheimen.organization_member enable row level security;
alter table roiheimen.organization_invite enable row level security;

-- Organization: can view if member
create policy select_organization on roiheimen.organization
  for select to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    )
  );

-- Organization members: users can see all members of organizations they belong to
-- We use a security definer helper function to avoid RLS recursion
create or replace function roiheimen_private.user_is_org_member(org_id integer, uid integer)
returns boolean as $$
  select exists (
    select 1 from roiheimen.organization_member
    where organization_id = org_id and user_id = uid
  );
$$ language sql stable security definer;

-- Grant execute on helper function to roiheimen_user (requires schema usage)
grant usage on schema roiheimen_private to roiheimen_user;
grant execute on function roiheimen_private.user_is_org_member(integer, integer) to roiheimen_user;

create policy select_organization_member on roiheimen.organization_member
  for select to roiheimen_user
  using (
    roiheimen_private.user_is_org_member(
      organization_id,
      nullif(current_setting('jwt.claims.user_id', true), '')::integer
    )
  );

-- Organization invites: admins/owners can see invites for their orgs
create policy select_organization_invite on roiheimen.organization_invite
  for select to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting Invite RLS
alter table roiheimen.meeting_invite enable row level security;
alter table roiheimen.meeting_participant enable row level security;

-- Meeting invite: org admins/owners can view invites for their org's meetings
create policy select_meeting_invite on roiheimen.meeting_invite
  for select to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting invite: org admins/owners can insert invites
create policy insert_meeting_invite on roiheimen.meeting_invite
  for insert to roiheimen_user
  with check (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting invite: org admins/owners can update invites
create policy update_meeting_invite on roiheimen.meeting_invite
  for update to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting invite: org admins/owners can delete invites
create policy delete_meeting_invite on roiheimen.meeting_invite
  for delete to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting participant RLS
-- Users can see participants in meetings they are part of, or org members can see
create policy select_meeting_participant on roiheimen.meeting_participant
  for select to roiheimen_user
  using (
    -- User is a participant in this meeting
    user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    OR
    -- User is an org member with access to this meeting
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    )
  );

-- Meeting participant: users can insert themselves, or org admins can add
create policy insert_meeting_participant on roiheimen.meeting_participant
  for insert to roiheimen_user
  with check (
    -- User is adding themselves
    user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    OR
    -- User is an org admin/owner
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting participant: org admins/owners can update
create policy update_meeting_participant on roiheimen.meeting_participant
  for update to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
  );

-- Meeting participant: org admins/owners can delete
create policy delete_meeting_participant on roiheimen.meeting_participant
  for delete to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = meeting_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
        and om.role in ('owner', 'admin')
    )
