
create function roiheimen.person_latest_speech(person roiheimen.person) returns roiheimen.speech as $$
  select speech.*
  from roiheimen.speech as speech
  where speech.speaker_id = person.id
  order by created_at desc
  limit 1
$$ language sql stable;
comment on function roiheimen.person_latest_speech(roiheimen.person) is 'Gets the latest speech written by the person.';

create function roiheimen.latest_sak(meeting_id text) returns roiheimen.sak as $$
  select *
    from roiheimen.sak
    where finished_at is null
    and meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
    order by created_at desc
    limit 1
$$ language sql stable;

-- create function roiheimen.current_speeches(meeting_id text, sak_id int) returns roiheimen.speech as $$
--   select *
--     from roiheimen.sak
--     where finished_at is null
--     and meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
--     order by created_at desc
--     limit 1
-- $$ language sql stable;

create or replace function roiheimen.current_speech(meeting_id text) returns roiheimen.speech as $$
select *
  from roiheimen.speech
  where ended_at is null
  and started_at is not null
  and sak_id = (
    select id
      from roiheimen.sak
      where finished_at is null
      and meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
      order by created_at desc
      limit 1)
  limit 1;
$$ language sql stable;

create or replace function roiheimen.vote_count(sak_id integer) returns table(referendum_id integer, choice text, cnt bigint) as $$
  select referendum_id, vote, count(vote)
    from roiheimen.vote
    where referendum_id in (
      select id from roiheimen.referendum where sak_id = $1)
    group by referendum_id, vote;
$$ language sql stable security definer;
comment on function roiheimen.vote_count(integer) is 'Returns the number of votes for each choice in a referendum.';

create function roiheimen.current_person() returns roiheimen.person as $$
  select *
  from roiheimen.person
  where id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
$$ language sql stable;
comment on function roiheimen.current_person() is 'Gets the person who was identified by our JWT.';

-- Helper function to get the meeting_id from the current person's JWT
-- Used by RLS policies to derive meeting context from person_id instead of jwt.claims.meeting_id
create function roiheimen_private.current_meeting_id() returns text as $$
  select meeting_id from roiheimen.person
  where id = nullif(current_setting('jwt.claims.person_id', true), '')::integer
$$ language sql stable security definer;

-- Grant execute on helper function to roles that need it
grant usage on schema roiheimen_private to roiheimen_person;
grant execute on function roiheimen_private.current_meeting_id() to roiheimen_person;

-- current_participant: Returns the meeting_participant for the current user and meeting
-- This is the new function for the SaaS platform, providing participant info for users
-- who joined via invite code or org membership
create or replace function roiheimen.current_participant() returns roiheimen.meeting_participant as $$
  select mp.*
  from roiheimen.meeting_participant mp
  where mp.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    and mp.meeting_id = roiheimen_private.current_meeting_id()
$$ language sql stable;
comment on function roiheimen.current_participant() is 'Gets the meeting participant for the current user and meeting from JWT.';

create or replace function roiheimen.stats_people_meeting(meeting_id text)
  returns table (
    person_id int,
    speeches_innlegg bigint,
    speeches_replikk bigint,
    speeches bigint,
    votes bigint
  ) as $$
select id as person_id,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'innlegg') speeches_innlegg,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id and type = 'replikk') speeches_replikk,
  (select count(*) from roiheimen.speech s where s.speaker_id = p.id) speeches,
  (select count(*) from roiheimen.vote v where v.person_id = p.id) votes
  from roiheimen.person p
  where meeting_id = coalesce($1, roiheimen_private.current_meeting_id())
  order by num desc;
$$ language sql stable;
comment on function roiheimen.stats_people_meeting(text) is E'@foreignKey (person_id) references person (id)\nGets some basic stats on participation in meeting.';

-- User account functions

-- register_user: Create new user account with email verification token
create or replace function roiheimen.register_user(
  email text,
  password text,
  name text
) returns roiheimen.register_user_result as $$
declare
  new_user roiheimen.user_account;
  verification_token text;
begin
  -- Validate password strength (minimum 8 characters)
  if char_length(password) < 8 then
    raise exception 'Password must be at least 8 characters long';
  end if;

  -- Create user account
  insert into roiheimen.user_account (email, name)
    values (lower(trim(email)), trim(name))
    returning * into new_user;

  -- Create credentials
  insert into roiheimen_private.user_credentials (user_id, password_hash)
    values (new_user.id, crypt(password, gen_salt('bf')));

  -- Generate verification token (14-char hex)
  verification_token := encode(gen_random_bytes(7), 'hex');

  -- Create email verification record
  insert into roiheimen_private.email_verification (user_id, token)
    values (new_user.id, verification_token);

  return (new_user.id, verification_token)::roiheimen.register_user_result;
end;
$$ language plpgsql security definer;
comment on function roiheimen.register_user(text, text, text) is 'Registers a new user account and returns a verification token to be emailed';

-- verify_email: Mark email as verified using token
create or replace function roiheimen.verify_email(
  token text
) returns boolean as $$
declare
  verification roiheimen_private.email_verification;
begin
  -- Find valid, unused token
  select * into verification
    from roiheimen_private.email_verification ev
    where ev.token = verify_email.token
      and ev.used_at is null
      and ev.expires_at > now();

  if verification.id is null then
    return false;
  end if;

  -- Mark token as used
  update roiheimen_private.email_verification
    set used_at = now()
    where id = verification.id;

  -- Mark email as verified
  update roiheimen_private.user_credentials
    set email_verified = true
    where user_id = verification.user_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.verify_email(text) is 'Verifies a user email using the verification token';

-- authenticate_user: Login with email/password, returns JWT
-- Includes brute force protection: locks after 3 failures in 5 minutes
create or replace function roiheimen.authenticate_user(
  email text,
  password text
) returns roiheimen.jwt_token as $$
declare
  user_record roiheimen.user_account;
  credentials roiheimen_private.user_credentials;
  lockout_duration interval := interval '5 minutes';
  max_attempts integer := 3;
begin
  -- Find user by email (case-insensitive)
  select * into user_record
    from roiheimen.user_account ua
    where lower(ua.email) = lower(trim(authenticate_user.email));

  if user_record.id is null then
    return null;
  end if;

  -- Get credentials
  select * into credentials
    from roiheimen_private.user_credentials uc
    where uc.user_id = user_record.id;

  -- Check for lockout (3 failures within 5 minutes)
  if credentials.failed_attempts >= max_attempts
     and credentials.first_failed_at > (now() - lockout_duration) then
    raise exception 'Account temporarily locked. Try again later.';
  end if;

  -- Reset failed attempts if lockout period has passed
  if credentials.first_failed_at is not null
     and credentials.first_failed_at <= (now() - lockout_duration) then
    update roiheimen_private.user_credentials
      set failed_attempts = 0, first_failed_at = null
      where user_id = user_record.id;
    select * into credentials
      from roiheimen_private.user_credentials uc
      where uc.user_id = user_record.id;
  end if;

  -- Check password
  if credentials.password_hash = crypt(password, credentials.password_hash) then
    if not credentials.email_verified then
      raise exception 'Email not verified. Please check your inbox.';
    end if;

    update roiheimen_private.user_credentials
      set failed_attempts = 0, first_failed_at = null
      where user_id = user_record.id;

    insert into roiheimen_private.user_session (user_id)
      values (user_record.id);

    return (
      'roiheimen_user',
      null,
      false,
      extract(epoch from (now() + interval '6 days')),
      user_record.id
    )::roiheimen.jwt_token;
  else
    update roiheimen_private.user_credentials
      set
        failed_attempts = case
          when first_failed_at is null or first_failed_at <= (now() - lockout_duration)
          then 1
          else failed_attempts + 1
        end,
        first_failed_at = case
          when first_failed_at is null or first_failed_at <= (now() - lockout_duration)
          then now()
          else first_failed_at
        end
      where user_id = user_record.id;

    return null;
  end if;
end;
$$ language plpgsql security definer;
comment on function roiheimen.authenticate_user(text, text) is 'Authenticates a user with email/password and returns a JWT token';

-- request_password_reset: Generate password reset token
create or replace function roiheimen.request_password_reset(
  email text
) returns text as $$
declare
  user_record roiheimen.user_account;
  reset_token text;
begin
  -- Find user by email (case-insensitive)
  select * into user_record
    from roiheimen.user_account ua
    where lower(ua.email) = lower(trim(request_password_reset.email));

  if user_record.id is null then
    -- User not found - return null but don't reveal this
    return null;
  end if;

  -- Invalidate any existing unused reset tokens for this user
  update roiheimen_private.password_reset
    set used_at = now()
    where user_id = user_record.id
      and used_at is null;

  -- Generate new reset token (14-char hex)
  reset_token := encode(gen_random_bytes(7), 'hex');

  -- Create password reset record (1 hour expiry)
  insert into roiheimen_private.password_reset (user_id, token)
    values (user_record.id, reset_token);

  return reset_token;
end;
$$ language plpgsql security definer;
comment on function roiheimen.request_password_reset(text) is 'Generates a password reset token for the given email';

-- reset_password: Set new password using reset token
create or replace function roiheimen.reset_password(
  token text,
  new_password text
) returns boolean as $$
declare
  reset_record roiheimen_private.password_reset;
begin
  -- Validate password strength
  if char_length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters long';
  end if;

  -- Find valid, unused token
  select * into reset_record
    from roiheimen_private.password_reset pr
    where pr.token = reset_password.token
      and pr.used_at is null
      and pr.expires_at > now();

  if reset_record.id is null then
    return false;
  end if;

  -- Mark token as used
  update roiheimen_private.password_reset
    set used_at = now()
    where id = reset_record.id;

  -- Update password and verify email (password reset confirms email ownership)
  update roiheimen_private.user_credentials
    set password_hash = crypt(new_password, gen_salt('bf')),
        email_verified = true,
        failed_attempts = 0,
        first_failed_at = null
    where user_id = reset_record.user_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.reset_password(text, text) is 'Resets a user password using the reset token';

-- current_user_account: Get the currently authenticated user
create or replace function roiheimen.current_user_account() returns roiheimen.user_account as $$
  select *
  from roiheimen.user_account
  where id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
$$ language sql stable;
comment on function roiheimen.current_user_account() is 'Gets the user who was identified by our JWT';

-- user_logout: End user session
create or replace function roiheimen.user_logout() returns boolean as $$
declare
  current_user_id integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    return false;
  end if;

  update roiheimen_private.user_session
    set logout_at = now()
    where user_id = current_user_id
      and logout_at is null;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.user_logout() is 'Logs out the current user session';

-- Organization functions

-- create_organization: Create a new organization and add creator as owner
create or replace function roiheimen.create_organization(
  slug text,
  name text
) returns roiheimen.organization as $$
declare
  new_org roiheimen.organization;
  current_user_id integer;
begin
  -- Get current user ID from JWT
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to create an organization';
  end if;

  -- Create the organization
  insert into roiheimen.organization (slug, name)
    values (lower(trim(create_organization.slug)), trim(create_organization.name))
    returning * into new_org;

  -- Add creator as owner
  insert into roiheimen.organization_member (organization_id, user_id, role)
    values (new_org.id, current_user_id, 'owner');

  return new_org;
end;
$$ language plpgsql security definer;
comment on function roiheimen.create_organization(text, text) is 'Creates a new organization and adds the current user as owner';

-- update_organization: Update organization name/config (admin+ only)
create or replace function roiheimen.update_organization(
  org_id integer,
  new_name text default null,
  new_config jsonb default null
) returns roiheimen.organization as $$
declare
  updated_org roiheimen.organization;
  current_user_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to update an organization';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to update the organization';
  end if;

  -- Update the organization
  update roiheimen.organization
    set
      name = coalesce(trim(new_name), name),
      config = coalesce(new_config, config)
    where id = org_id
    returning * into updated_org;

  return updated_org;
end;
$$ language plpgsql security definer;
comment on function roiheimen.update_organization(integer, text, jsonb) is 'Updates organization name and/or config';

-- invite_to_organization: Invite someone by email (admin+ only)
create or replace function roiheimen.invite_to_organization(
  org_id integer,
  invite_email text,
  invite_role roiheimen.organization_role default 'member'
) returns roiheimen.organization_invite as $$
declare
  new_invite roiheimen.organization_invite;
  current_user_id integer;
  user_role roiheimen.organization_role;
  invite_token text;
  existing_member integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to invite members';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to invite members';
  end if;

  -- Only owners can invite admins/owners
  if invite_role in ('owner', 'admin') and user_role != 'owner' then
    raise exception 'Only owners can invite admins or owners';
  end if;

  -- Check if email is already a member
  select om.user_id into existing_member
    from roiheimen.organization_member om
    join roiheimen.user_account ua on ua.id = om.user_id
    where om.organization_id = org_id
      and lower(ua.email) = lower(trim(invite_email));

  if existing_member is not null then
    raise exception 'This user is already a member of the organization';
  end if;

  -- Generate invite token
  invite_token := encode(gen_random_bytes(16), 'hex');

  -- Create or update invite (upsert)
  insert into roiheimen.organization_invite (organization_id, email, role, invited_by, token)
    values (org_id, lower(trim(invite_email)), invite_role, current_user_id, invite_token)
    on conflict (organization_id, email) do update
      set role = invite_role,
          invited_by = current_user_id,
          token = invite_token,
          expires_at = now() + interval '7 days',
          accepted_at = null,
          created_at = now()
    returning * into new_invite;

  return new_invite;
end;
$$ language plpgsql security definer;
comment on function roiheimen.invite_to_organization(integer, text, roiheimen.organization_role) is 'Invites a user to join an organization by email';

-- accept_organization_invite: Accept invite using token
create or replace function roiheimen.accept_organization_invite(
  invite_token text
) returns roiheimen.organization_member as $$
declare
  invite roiheimen.organization_invite;
  current_user_id integer;
  current_user_email text;
  new_member roiheimen.organization_member;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to accept an invitation';
  end if;

  -- Get current user's email
  select email into current_user_email
    from roiheimen.user_account
    where id = current_user_id;

  -- Find valid invite
  select * into invite
    from roiheimen.organization_invite
    where token = invite_token
      and accepted_at is null
      and expires_at > now();

  if invite.id is null then
    raise exception 'Invalid or expired invitation';
  end if;

  -- Verify email matches
  if lower(current_user_email) != lower(invite.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  -- Mark invite as accepted
  update roiheimen.organization_invite
    set accepted_at = now()
    where id = invite.id;

  -- Add user as member
  insert into roiheimen.organization_member (organization_id, user_id, role)
    values (invite.organization_id, current_user_id, invite.role)
    returning * into new_member;

  return new_member;
end;
$$ language plpgsql security definer;
comment on function roiheimen.accept_organization_invite(text) is 'Accepts an organization invitation using the invite token';

-- remove_organization_member: Remove a member (admin+ can remove members, owners can remove anyone except themselves if only owner)
create or replace function roiheimen.remove_organization_member(
  org_id integer,
  member_user_id integer
) returns boolean as $$
declare
  current_user_id integer;
  user_role roiheimen.organization_role;
  target_role roiheimen.organization_role;
  owner_count integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to remove members';
  end if;

  -- Get current user's role
  select role into user_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  -- Get target user's role
  select role into target_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = member_user_id;

  if target_role is null then
    raise exception 'User is not a member of this organization';
  end if;

  -- Check permissions
  if user_role = 'member' then
    raise exception 'Members cannot remove other members';
  end if;

  if user_role = 'admin' and target_role in ('owner', 'admin') then
    raise exception 'Admins can only remove regular members';
  end if;

  -- Prevent removing the last owner
  if target_role = 'owner' then
    select count(*) into owner_count
      from roiheimen.organization_member
      where organization_id = org_id and role = 'owner';

    if owner_count <= 1 then
      raise exception 'Cannot remove the last owner of the organization';
    end if;
  end if;

  -- Remove the member
  delete from roiheimen.organization_member
    where organization_id = org_id and user_id = member_user_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.remove_organization_member(integer, integer) is 'Removes a member from an organization';

-- delete_organization: Delete an organization (owner only)
create or replace function roiheimen.delete_organization(
  org_id integer
) returns boolean as $$
declare
  current_user_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to delete an organization';
  end if;

  -- Check user is owner
  select role into user_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role != 'owner' then
    raise exception 'Only owners can delete an organization';
  end if;

  -- Delete the organization (cascade will handle members and invites)
  delete from roiheimen.organization where id = org_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.delete_organization(integer) is 'Deletes an organization (owner only)';

-- my_organizations: Get organizations the current user is a member of
create or replace function roiheimen.my_organizations()
returns setof roiheimen.organization as $$
  select o.*
    from roiheimen.organization o
    join roiheimen.organization_member om on om.organization_id = o.id
    where om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    order by o.name;
$$ language sql stable security definer;
comment on function roiheimen.my_organizations() is 'Returns all organizations the current user is a member of';

-- get_organization_by_slug: Get organization by slug (only if member)
-- Note: Named get_organization_by_slug to avoid PostGraphile naming conflict with organizationBySlug from unique constraint
create or replace function roiheimen.get_organization_by_slug(
  org_slug text
) returns roiheimen.organization as $$
  select o.*
    from roiheimen.organization o
    join roiheimen.organization_member om on om.organization_id = o.id
    where o.slug = lower(org_slug)
      and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer;
$$ language sql stable security definer;
comment on function roiheimen.get_organization_by_slug(text) is 'Returns an organization by slug if the current user is a member';

-- organization_my_role: Get current user's role in an organization (computed field on Organization)
-- Named organization_* so PostGraphile exposes it as a computed field 'myRole' on Organization type
create or replace function roiheimen.organization_my_role(
  org roiheimen.organization
) returns roiheimen.organization_role as $$
  select role
    from roiheimen.organization_member
    where organization_id = org.id
      and user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer;
$$ language sql stable;
comment on function roiheimen.organization_my_role(roiheimen.organization) is 'Returns the current user''s role in the given organization';

-- organization_member_info: Composite type for org member with user info
create type roiheimen.organization_member_info as (
  member_id integer,
  user_id integer,
  email text,
  name text,
  role roiheimen.organization_role,
  joined_at timestamptz
);

-- get_organization_members: Get all members of an organization with user info
create or replace function roiheimen.get_organization_members(
  org_id integer
) returns setof roiheimen.organization_member_info as $$
declare
  current_user_id integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to view organization members';
  end if;

  -- Verify user is a member of this organization
  if not exists (
    select 1 from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id
  ) then
    raise exception 'You are not a member of this organization';
  end if;

  return query
    select
      om.id as member_id,
      om.user_id,
      ua.email,
      ua.name,
      om.role,
      om.created_at as joined_at
    from roiheimen.organization_member om
    join roiheimen.user_account ua on ua.id = om.user_id
    where om.organization_id = org_id
    order by
      case om.role
        when 'owner' then 1
        when 'admin' then 2
        else 3
      end,
      ua.name;
end;
$$ language plpgsql stable security definer;
comment on function roiheimen.get_organization_members(integer) is 'Returns all members of an organization with their user info';

-- create_org_meeting: Create a new meeting under an organization
-- Note: Named 'create_org_meeting' to avoid conflict with PostGraphile's auto-generated 'createMeeting' mutation
create or replace function roiheimen.create_org_meeting(
  org_id integer,
  meeting_id text,
  meeting_title text,
  meeting_config jsonb default '{}'
) returns roiheimen.meeting as $$
declare
  new_meeting roiheimen.meeting;
  current_user_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to create a meeting';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to create meetings';
  end if;

  -- Validate meeting_id
  if meeting_id is null or char_length(meeting_id) < 2 or char_length(meeting_id) > 31 then
    raise exception 'Meeting ID must be between 2 and 31 characters';
  end if;

  -- Check for valid meeting_id format (alphanumeric and hyphens)
  if meeting_id !~ '^[a-z0-9-]+$' then
    raise exception 'Meeting ID can only contain lowercase letters, numbers, and hyphens';
  end if;

  -- Create the meeting
  insert into roiheimen.meeting (id, title, config, organization_id, created_by)
    values (lower(trim(meeting_id)), trim(meeting_title), meeting_config, org_id, current_user_id)
    returning * into new_meeting;

  return new_meeting;
end;
$$ language plpgsql security definer;
comment on function roiheimen.create_org_meeting(integer, text, text, jsonb) is 'Creates a new meeting under an organization';

-- update_org_meeting: Update a meeting's title and/or config
-- Note: Named 'update_org_meeting' to avoid conflict with PostGraphile's auto-generated 'updateMeeting' mutation
create or replace function roiheimen.update_org_meeting(
  meeting_id text,
  new_title text default null,
  new_config jsonb default null
) returns roiheimen.meeting as $$
declare
  updated_meeting roiheimen.meeting;
  current_user_id integer;
  meeting_org_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to update a meeting';
  end if;

  -- Get meeting's organization
  select organization_id into meeting_org_id
    from roiheimen.meeting
    where id = meeting_id;

  if meeting_org_id is null then
    raise exception 'Meeting not found or not associated with an organization';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = meeting_org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to update meetings';
  end if;

  -- Update the meeting
  update roiheimen.meeting
    set
      title = coalesce(trim(new_title), title),
      config = coalesce(new_config, config),
      updated_at = now()
    where id = meeting_id
    returning * into updated_meeting;

  return updated_meeting;
end;
$$ language plpgsql security definer;
comment on function roiheimen.update_org_meeting(text, text, jsonb) is 'Updates a meeting title and/or config';

-- delete_org_meeting: Delete a meeting (owner only)
-- Note: Named 'delete_org_meeting' to avoid conflict with PostGraphile's auto-generated 'deleteMeeting' mutation
create or replace function roiheimen.delete_org_meeting(
  meeting_id text
) returns boolean as $$
declare
  current_user_id integer;
  meeting_org_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to delete a meeting';
  end if;

  -- Get meeting's organization
  select organization_id into meeting_org_id
    from roiheimen.meeting
    where id = meeting_id;

  if meeting_org_id is null then
    raise exception 'Meeting not found or not associated with an organization';
  end if;

  -- Check user is owner of the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = meeting_org_id and user_id = current_user_id;

  if user_role is null then
    raise exception 'You are not a member of this organization';
  end if;

  if user_role != 'owner' then
    raise exception 'Only organization owners can delete meetings';
  end if;

  -- Delete the meeting (cascade will handle related data)
  delete from roiheimen.meeting where id = meeting_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.delete_org_meeting(text) is 'Deletes a meeting (owner only)';

-- organization_meetings: Get all meetings for an organization
-- Note: We use @fieldName organizationMeetings in the comment to avoid naming conflict
-- with the automatic 'meetings' field from the FK relation
create or replace function roiheimen.organization_meetings(
  org roiheimen.organization
) returns setof roiheimen.meeting as $$
  select m.*
    from roiheimen.meeting m
    where m.organization_id = org.id
    order by m.created_at desc;
$$ language sql stable;
comment on function roiheimen.organization_meetings(roiheimen.organization) is E'@fieldName organizationMeetings\nReturns all meetings belonging to an organization';

-- Meeting invite functions

-- create_invite_code: Creates an invite code for a meeting
create or replace function roiheimen.create_invite_code(
  p_meeting_id text,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
) returns roiheimen.meeting_invite as $$
declare
  current_user_id integer;
  meeting_org_id integer;
  user_role roiheimen.organization_role;
  invite_code text;
  new_invite roiheimen.meeting_invite;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to create invite codes';
  end if;

  -- Get meeting's organization
  select organization_id into meeting_org_id
    from roiheimen.meeting
    where id = p_meeting_id;

  if meeting_org_id is null then
    raise exception 'Meeting not found or not associated with an organization';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = meeting_org_id and user_id = current_user_id;

  if user_role is null or user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to create invite codes';
  end if;

  -- Generate unique invite code (8 characters, alphanumeric)
  loop
    invite_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
    -- Replace confusing characters
    invite_code := replace(replace(replace(replace(invite_code, '/', 'A'), '+', 'B'), '0', 'X'), 'O', 'Y');
    exit when not exists (select 1 from roiheimen.meeting_invite where code = invite_code);
  end loop;

  -- Create the invite
  insert into roiheimen.meeting_invite (meeting_id, code, max_uses, expires_at, created_by)
    values (p_meeting_id, invite_code, p_max_uses, p_expires_at, current_user_id)
    returning * into new_invite;

  return new_invite;
end;
$$ language plpgsql security definer;
comment on function roiheimen.create_invite_code(text, integer, timestamptz) is 'Creates an invite code for a meeting';

-- Type for validate_invite_code result
create type roiheimen.invite_validation_result as (
  meeting_id text,
  meeting_title text,
  org_name text,
  is_valid boolean
);
comment on type roiheimen.invite_validation_result is 'Result of validating an invite code';

-- validate_invite_code: Validates an invite code and returns meeting info if valid
create or replace function roiheimen.validate_invite_code(
  p_code text
) returns setof roiheimen.invite_validation_result as $$
declare
  invite roiheimen.meeting_invite;
begin
  -- Find the invite code
  select * into invite
    from roiheimen.meeting_invite mi
    where upper(mi.code) = upper(p_code);

  if invite.id is null then
    return query select null::text, null::text, null::text, false;
    return;
  end if;

  -- Check if expired
  if invite.expires_at is not null and invite.expires_at < now() then
    return query select null::text, null::text, null::text, false;
    return;
  end if;

  -- Check if max uses reached
  if invite.max_uses is not null and invite.uses_count >= invite.max_uses then
    return query select null::text, null::text, null::text, false;
    return;
  end if;

  -- Return meeting info
  return query
    select m.id, m.title, o.name, true
    from roiheimen.meeting m
    join roiheimen.organization o on o.id = m.organization_id
    where m.id = invite.meeting_id;
end;
$$ language plpgsql security definer;
comment on function roiheimen.validate_invite_code(text) is 'Validates an invite code and returns meeting info if valid';

-- join_meeting: Joins a meeting using an invite code
-- Also creates a person record for legacy compatibility with speech/vote tables
create or replace function roiheimen.join_meeting(
  p_meeting_id text,
  p_invite_code text,
  p_display_name text
) returns roiheimen.meeting_participant as $$
declare
  current_user_id integer;
  invite roiheimen.meeting_invite;
  next_num integer;
  new_participant roiheimen.meeting_participant;
  new_person roiheimen.person;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to join a meeting';
  end if;

  -- Check if already a participant
  if exists (
    select 1 from roiheimen.meeting_participant
    where meeting_id = p_meeting_id and user_id = current_user_id
  ) then
    raise exception 'You are already a participant in this meeting';
  end if;

  -- Validate invite code
  select * into invite
    from roiheimen.meeting_invite mi
    where upper(mi.code) = upper(p_invite_code)
      and mi.meeting_id = p_meeting_id;

  if invite.id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Check if expired
  if invite.expires_at is not null and invite.expires_at < now() then
    raise exception 'This invite code has expired';
  end if;

  -- Check if max uses reached
  if invite.max_uses is not null and invite.uses_count >= invite.max_uses then
    raise exception 'This invite code has reached its maximum uses';
  end if;

  -- Get next participant number (considering both tables for uniqueness)
  select greatest(
    coalesce((select max(participant_num) + 1 from roiheimen.meeting_participant where meeting_id = p_meeting_id), 1),
    coalesce((select max(num) + 1 from roiheimen.person where meeting_id = p_meeting_id), 1)
  ) into next_num;

  -- Create the person record for legacy compatibility (speech, vote tables)
  insert into roiheimen.person (num, name, admin, meeting_id, org)
    values (next_num, trim(p_display_name), false, p_meeting_id, '')
    returning * into new_person;

  -- Create participant with link to person record
  insert into roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, joined_via, person_id)
    values (p_meeting_id, current_user_id, trim(p_display_name), next_num, invite.id, new_person.id)
    returning * into new_participant;

  -- Increment uses count
  update roiheimen.meeting_invite
    set uses_count = uses_count + 1
    where id = invite.id;

  return new_participant;
end;
$$ language plpgsql security definer;
comment on function roiheimen.join_meeting(text, text, text) is 'Joins a meeting using an invite code';

-- get_meeting_token: Returns a meeting-scoped JWT for a participant
-- Also creates person record for org members (organizers) for legacy compatibility
create or replace function roiheimen.get_meeting_token(
  p_meeting_id text
) returns roiheimen.jwt_token as $$
declare
  current_user_id integer;
  participant roiheimen.meeting_participant;
  new_person roiheimen.person;
  user_name text;
  next_num integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to get a meeting token';
  end if;

  -- Check if user is a participant
  select * into participant
    from roiheimen.meeting_participant
    where meeting_id = p_meeting_id and user_id = current_user_id;

  if participant.id is null then
    -- Check if user is an org member (organizers automatically have access)
    if not exists (
      select 1 from roiheimen.meeting m
      join roiheimen.organization_member om on om.organization_id = m.organization_id
      where m.id = p_meeting_id
        and om.user_id = current_user_id
    ) then
      raise exception 'You are not a participant in this meeting';
    end if;

    -- Get user name for the person/participant records
    select name into user_name from roiheimen.user_account where id = current_user_id;

    -- Get next participant number (considering both tables)
    select greatest(
      coalesce((select max(participant_num) + 1 from roiheimen.meeting_participant where meeting_id = p_meeting_id), 1),
      coalesce((select max(num) + 1 from roiheimen.person where meeting_id = p_meeting_id), 1)
    ) into next_num;

    -- Create person record for org member/organizer (for legacy compatibility)
    insert into roiheimen.person (num, name, admin, meeting_id, org)
      values (next_num, user_name, true, p_meeting_id, '')
      returning * into new_person;

    -- Create organizer participant entry with link to person
    insert into roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, is_organizer, person_id)
      values (p_meeting_id, current_user_id, user_name, next_num, true, new_person.id)
      returning * into participant;
  end if;

  -- Return JWT with person_id (meeting_id is derived from person record via current_meeting_id())
  return (
    'roiheimen_person',
    participant.person_id,
    participant.is_organizer, -- Organizers get admin access
    extract(epoch from (now() + interval '6 days')),
    current_user_id
  )::roiheimen.jwt_token;
end;
$$ language plpgsql security definer;
comment on function roiheimen.get_meeting_token(text) is 'Returns a meeting-scoped JWT for a participant';

-- delete_invite_code: Deletes an invite code
create or replace function roiheimen.delete_invite_code(
  p_invite_id integer
) returns boolean as $$
declare
  current_user_id integer;
  invite roiheimen.meeting_invite;
  meeting_org_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to delete invite codes';
  end if;

  -- Get invite
  select * into invite
    from roiheimen.meeting_invite
    where id = p_invite_id;

  if invite.id is null then
    raise exception 'Invite code not found';
  end if;

  -- Get meeting's organization
  select organization_id into meeting_org_id
    from roiheimen.meeting
    where id = invite.meeting_id;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = meeting_org_id and user_id = current_user_id;

  if user_role is null or user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to delete invite codes';
  end if;

  -- Delete the invite
  delete from roiheimen.meeting_invite where id = p_invite_id;

  return true;
end;
$$ language plpgsql security definer;
comment on function roiheimen.delete_invite_code(integer) is 'Deletes an invite code';

-- get_meeting_invites: Gets all invites for a meeting
create or replace function roiheimen.get_meeting_invites(
  p_meeting_id text
) returns setof roiheimen.meeting_invite as $$
declare
  current_user_id integer;
  meeting_org_id integer;
  user_role roiheimen.organization_role;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to view invite codes';
  end if;

  -- Get meeting's organization
  select organization_id into meeting_org_id
    from roiheimen.meeting
    where id = p_meeting_id;

  if meeting_org_id is null then
    raise exception 'Meeting not found or not associated with an organization';
  end if;

  -- Check user's role in the organization
  select role into user_role
    from roiheimen.organization_member
    where organization_id = meeting_org_id and user_id = current_user_id;

  if user_role is null or user_role not in ('owner', 'admin') then
    raise exception 'You must be an admin or owner to view invite codes';
  end if;

  return query
    select * from roiheimen.meeting_invite
    where meeting_id = p_meeting_id
    order by created_at desc;
end;
$$ language plpgsql security definer;
comment on function roiheimen.get_meeting_invites(text) is 'Gets all invites for a meeting';

-- get_meeting_participants: Gets all participants for a meeting
create or replace function roiheimen.get_meeting_participants(
  p_meeting_id text
) returns setof roiheimen.meeting_participant as $$
declare
  current_user_id integer;
  meeting_org_id integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to view participants';
  end if;

  -- Check if user is a participant or org member
  if not exists (
    select 1 from roiheimen.meeting_participant
    where meeting_id = p_meeting_id and user_id = current_user_id
  ) then
    -- Check if org member
    select organization_id into meeting_org_id
      from roiheimen.meeting
      where id = p_meeting_id;

    if not exists (
      select 1 from roiheimen.organization_member
      where organization_id = meeting_org_id and user_id = current_user_id
    ) then
      raise exception 'You are not authorized to view participants';
    end if;
  end if;

  return query
    select * from roiheimen.meeting_participant
    where meeting_id = p_meeting_id
    order by participant_num;
end;
$$ language plpgsql security definer;
comment on function roiheimen.get_meeting_participants(text) is 'Gets all participants for a meeting';

-- Activity feed types and functions
create type roiheimen.activity_item as (
  activity_type text,          -- 'org_created', 'org_joined', 'meeting_created', 'meeting_joined', 'invite_created'
  activity_title text,         -- Display title
  activity_description text,   -- Additional context (e.g., role, meeting title)
  activity_timestamp timestamptz,
  org_slug text,               -- For navigation
  meeting_id text              -- For navigation
);

-- get_user_activity: Returns recent activity for the current user
create or replace function roiheimen.get_user_activity(
  activity_limit integer default 10
) returns setof roiheimen.activity_item as $$
declare
  current_user_id integer;
begin
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  if current_user_id is null then
    raise exception 'You must be logged in to view activity';
  end if;

  return query
  (
    -- Organizations the user created (they became owner)
    select
      'org_created'::text as activity_type,
      o.name as activity_title,
      'Du oppretta organisasjonen'::text as activity_description,
      om.created_at as activity_timestamp,
      o.slug as org_slug,
      null::text as meeting_id
    from roiheimen.organization_member om
    join roiheimen.organization o on o.id = om.organization_id
    where om.user_id = current_user_id
      and om.role = 'owner'

    union all

    -- Organizations the user joined (not as owner)
    select
      'org_joined'::text as activity_type,
      o.name as activity_title,
      case om.role
        when 'admin' then 'Du vart administrator'
        else 'Du vart medlem'
      end as activity_description,
      om.created_at as activity_timestamp,
      o.slug as org_slug,
      null::text as meeting_id
    from roiheimen.organization_member om
    join roiheimen.organization o on o.id = om.organization_id
    where om.user_id = current_user_id
      and om.role != 'owner'

    union all

    -- Meetings the user created
    select
      'meeting_created'::text as activity_type,
      m.title as activity_title,
      'Du oppretta motet i ' || o.name as activity_description,
      m.created_at as activity_timestamp,
      o.slug as org_slug,
      m.id as meeting_id
    from roiheimen.meeting m
    join roiheimen.organization o on o.id = m.organization_id
    where m.created_by = current_user_id

    union all

    -- Meetings the user joined (as participant)
    select
      'meeting_joined'::text as activity_type,
      m.title as activity_title,
      case mp.is_organizer
        when true then 'Du vart med som arrangor'
        else 'Du vart med som deltakar'
      end as activity_description,
      mp.created_at as activity_timestamp,
      o.slug as org_slug,
      m.id as meeting_id
    from roiheimen.meeting_participant mp
    join roiheimen.meeting m on m.id = mp.meeting_id
    left join roiheimen.organization o on o.id = m.organization_id
    where mp.user_id = current_user_id
  )
  order by activity_timestamp desc
  limit activity_limit;
end;
$$ language plpgsql security definer;
