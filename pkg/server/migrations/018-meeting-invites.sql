-- Migration: Meeting Invite System (Phase 4)
-- Creates tables and functions for meeting invites and participants

-- meeting_invite: Invite codes for joining meetings
create table roiheimen.meeting_invite (
  id               serial primary key,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  code             text not null unique,
  max_uses         integer default null, -- null = unlimited
  uses_count       integer default 0,
  expires_at       timestamptz default null, -- null = never expires
  created_by       integer not null references roiheimen.user_account(id) on delete cascade,
  created_at       timestamptz default now()
);
comment on table roiheimen.meeting_invite is 'Invite codes for joining meetings';
create index on roiheimen.meeting_invite(meeting_id);
create index on roiheimen.meeting_invite(code);
create index on roiheimen.meeting_invite(created_by);
create index on roiheimen.meeting_invite(expires_at);

-- meeting_participant: Users who have joined a meeting
create table roiheimen.meeting_participant (
  id               serial primary key,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  user_id          integer references roiheimen.user_account(id) on delete cascade,
  display_name     text not null check (char_length(display_name) > 0 and char_length(display_name) < 128),
  participant_num  integer not null, -- Sequential number within the meeting
  is_organizer     boolean default false,
  joined_via       integer references roiheimen.meeting_invite(id) on delete set null,
  created_at       timestamptz default now(),
  unique(meeting_id, user_id),
  unique(meeting_id, participant_num)
);
comment on table roiheimen.meeting_participant is 'Participants who have joined a meeting';
create index on roiheimen.meeting_participant(meeting_id);
create index on roiheimen.meeting_participant(user_id);
create index on roiheimen.meeting_participant(participant_num);

-- Enable RLS
alter table roiheimen.meeting_invite enable row level security;
alter table roiheimen.meeting_participant enable row level security;

-- Permissions
grant select on table roiheimen.meeting_invite to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting_invite to roiheimen_user;
grant usage on sequence roiheimen.meeting_invite_id_seq to roiheimen_user;

grant select on table roiheimen.meeting_participant to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting_participant to roiheimen_user;
grant usage on sequence roiheimen.meeting_participant_id_seq to roiheimen_user;

-- RLS Policies for meeting_invite
-- Org admins/owners can view invites for their org's meetings
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

-- Org admins/owners can insert invites for their org's meetings
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

-- Org admins/owners can update invites for their org's meetings
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

-- Org admins/owners can delete invites for their org's meetings
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

-- RLS Policies for meeting_participant
-- Users can see participants in meetings they are part of, or org members can see participants
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

-- Users can insert themselves as participants (via join_meeting function)
-- Org admins can also add participants
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

-- Org admins/owners can update participants
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

-- Org admins/owners can delete participants
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
  );

-- Function: create_invite_code
-- Creates an invite code for a meeting
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

-- Function: validate_invite_code
-- Validates an invite code and returns meeting info if valid
create or replace function roiheimen.validate_invite_code(
  p_code text
) returns table (
  meeting_id text,
  meeting_title text,
  org_name text,
  is_valid boolean
) as $$
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

-- Function: join_meeting
-- Joins a meeting using an invite code
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

  -- Get next participant number
  select coalesce(max(participant_num), 0) + 1 into next_num
    from roiheimen.meeting_participant
    where meeting_id = p_meeting_id;

  -- Create participant
  insert into roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, joined_via)
    values (p_meeting_id, current_user_id, trim(p_display_name), next_num, invite.id)
    returning * into new_participant;

  -- Increment uses count
  update roiheimen.meeting_invite
    set uses_count = uses_count + 1
    where id = invite.id;

  return new_participant;
end;
$$ language plpgsql security definer;
comment on function roiheimen.join_meeting(text, text, text) is 'Joins a meeting using an invite code';

-- Function: get_meeting_token
-- Returns a meeting-scoped JWT for a participant
create or replace function roiheimen.get_meeting_token(
  p_meeting_id text
) returns roiheimen.jwt_token as $$
declare
  current_user_id integer;
  participant roiheimen.meeting_participant;
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

    -- Create organizer participant entry
    insert into roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, is_organizer)
      select p_meeting_id, current_user_id, ua.name,
             coalesce((select max(participant_num) from roiheimen.meeting_participant where meeting_id = p_meeting_id), 0) + 1,
             true
      from roiheimen.user_account ua
      where ua.id = current_user_id
      returning * into participant;
  end if;

  -- Return meeting-scoped JWT
  -- Uses the existing jwt_token type with person_id set to participant_num for compatibility
  -- and meeting_id set to the meeting
  return (
    'roiheimen_person',
    participant.participant_num, -- Use participant_num as person_id for legacy compatibility
    p_meeting_id,
    participant.is_organizer, -- Organizers get admin access
    extract(epoch from (now() + interval '6 days')),
    current_user_id
  )::roiheimen.jwt_token;
end;
$$ language plpgsql security definer;
comment on function roiheimen.get_meeting_token(text) is 'Returns a meeting-scoped JWT for a participant';

-- Function: delete_invite_code
-- Deletes an invite code
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

-- Function: get_meeting_invites
-- Gets all invites for a meeting
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

-- Function: get_meeting_participants
-- Gets all participants for a meeting
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

-- Grant execute on new functions
grant execute on function roiheimen.create_invite_code(text, integer, timestamptz) to roiheimen_user;
grant execute on function roiheimen.validate_invite_code(text) to roiheimen_anonymous, roiheimen_user;
grant execute on function roiheimen.join_meeting(text, text, text) to roiheimen_user;
grant execute on function roiheimen.get_meeting_token(text) to roiheimen_user;
grant execute on function roiheimen.delete_invite_code(integer) to roiheimen_user;
grant execute on function roiheimen.get_meeting_invites(text) to roiheimen_user;
grant execute on function roiheimen.get_meeting_participants(text) to roiheimen_user;
