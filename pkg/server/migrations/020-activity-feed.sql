-- Migration 020: Activity feed function
-- Adds function to fetch recent user activity for dashboard

-- Activity item type
create type roiheimen.activity_item as (
  activity_type text,          -- 'org_created', 'org_joined', 'meeting_created', 'meeting_joined'
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
comment on function roiheimen.get_user_activity(integer) is 'Gets recent activity for the current user';

-- Permissions
grant usage on type roiheimen.activity_item to roiheimen_user;
grant execute on function roiheimen.get_user_activity(integer) to roiheimen_user;
