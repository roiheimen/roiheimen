-- Migration 019: Bridge meeting_participant to person table
-- This enables queue.html to work with the new meeting_participant system
-- by creating a corresponding person record when a participant joins

-- First, add a reference from meeting_participant to person
alter table roiheimen.meeting_participant
  add column if not exists person_id integer references roiheimen.person(id) on delete set null;

create index if not exists meeting_participant_person_id_idx
  on roiheimen.meeting_participant(person_id);

-- Update join_meeting to also create a person record
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

  -- Get next participant number (for both meeting_participant and person tables)
  select coalesce(max(participant_num), 0) + 1 into next_num
    from roiheimen.meeting_participant
    where meeting_id = p_meeting_id;

  -- Also ensure the num doesn't conflict with existing person records
  select greatest(
    next_num,
    coalesce((select max(num) + 1 from roiheimen.person where meeting_id = p_meeting_id), 1)
  ) into next_num;

  -- Create the person record for legacy compatibility (speech, vote tables)
  insert into roiheimen.person (num, name, admin, meeting_id, org)
    values (next_num, trim(p_display_name), false, p_meeting_id, '')
    returning * into new_person;

  -- Create password for the person (not used, but required by the system)
  insert into roiheimen_private.person_account (person_id, password_hash)
    values (new_person.id, crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')));

  -- Create participant
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

-- Update get_meeting_token to return the person_id (not participant_num)
create or replace function roiheimen.get_meeting_token(
  p_meeting_id text
) returns roiheimen.jwt_token as $$
declare
  current_user_id integer;
  participant roiheimen.meeting_participant;
  new_person roiheimen.person;
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
    declare
      user_name text;
      next_num integer;
    begin
      select name into user_name from roiheimen.user_account where id = current_user_id;

      -- Get next participant number
      select greatest(
        coalesce((select max(participant_num) + 1 from roiheimen.meeting_participant where meeting_id = p_meeting_id), 1),
        coalesce((select max(num) + 1 from roiheimen.person where meeting_id = p_meeting_id), 1)
      ) into next_num;

      -- Create person record for org member/organizer
      insert into roiheimen.person (num, name, admin, meeting_id, org)
        values (next_num, user_name, true, p_meeting_id, '')
        returning * into new_person;

      -- Create password for the person (not used, but required by the system)
      insert into roiheimen_private.person_account (person_id, password_hash)
        values (new_person.id, crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')));

      -- Create organizer participant entry
      insert into roiheimen.meeting_participant (meeting_id, user_id, display_name, participant_num, is_organizer, person_id)
        values (p_meeting_id, current_user_id, user_name, next_num, true, new_person.id)
        returning * into participant;
    end;
  end if;

  -- Return meeting-scoped JWT with person_id for legacy compatibility
  return (
    'roiheimen_person',
    participant.person_id, -- Use the actual person.id for legacy compatibility
    p_meeting_id,
    participant.is_organizer, -- Organizers get admin access
    extract(epoch from (now() + interval '6 days')),
    current_user_id
  )::roiheimen.jwt_token;
end;
$$ language plpgsql security definer;

-- Create current_participant function as an alternative to current_person
-- Returns data compatible with current_person but from meeting_participant
create or replace function roiheimen.current_participant() returns roiheimen.meeting_participant as $$
  select mp.*
  from roiheimen.meeting_participant mp
  where mp.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    and mp.meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
$$ language sql stable;
comment on function roiheimen.current_participant() is 'Gets the meeting participant for the current user and meeting from JWT.';

-- Grant permissions
grant execute on function roiheimen.current_participant() to roiheimen_person, roiheimen_user;
