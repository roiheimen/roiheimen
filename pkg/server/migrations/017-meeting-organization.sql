-- Migration 017: Add organization_id and created_by to meeting table
-- This links meetings to organizations for the new self-serve system

-- Add organization_id column (nullable for existing meetings)
alter table roiheimen.meeting
  add column if not exists organization_id integer references roiheimen.organization(id) on delete set null;

-- Add created_by column (nullable for existing meetings)
alter table roiheimen.meeting
  add column if not exists created_by integer references roiheimen.user_account(id) on delete set null;

-- Create indexes for the new columns
create index if not exists meeting_organization_id_idx on roiheimen.meeting(organization_id);
create index if not exists meeting_created_by_idx on roiheimen.meeting(created_by);

-- Grant permissions to roiheimen_user role for meeting operations
grant select on table roiheimen.meeting to roiheimen_user;
grant insert, update, delete on table roiheimen.meeting to roiheimen_user;

-- RLS policy for meetings: org members can view meetings in their orgs
-- Note: This is in addition to existing policy for meeting_id-based access
create policy select_meeting_org on roiheimen.meeting
  for select to roiheimen_user
  using (
    organization_id is not null and exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = roiheimen.meeting.organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
    )
  );

-- RLS policy for meetings: org admins/owners can insert meetings
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

-- RLS policy for meetings: org admins/owners can update meetings
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

-- RLS policy for meetings: org owners can delete meetings
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

-- Function to create a meeting under an organization
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

-- Function to update a meeting
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

-- Function to delete a meeting
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

-- Function to get meetings for an organization
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

-- Grant execute permissions
grant execute on function roiheimen.create_org_meeting(integer, text, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.update_org_meeting(text, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.delete_org_meeting(text) to roiheimen_user;
grant execute on function roiheimen.organization_meetings(roiheimen.organization) to roiheimen_user;
