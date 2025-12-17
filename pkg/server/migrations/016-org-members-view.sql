-- Migration 016: Organization members view
-- Creates function to get organization members with user info
-- Also adds RLS policy to allow viewing user_account of fellow org members

-- Add RLS policy to allow viewing user_account of fellow org members
-- This allows org members to see name/email of other members in their orgs
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

-- Create a composite type for org member with user info
-- This is returned by get_organization_members function
do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_member_info') then
    create type roiheimen.organization_member_info as (
      member_id integer,
      user_id integer,
      email text,
      name text,
      role roiheimen.organization_role,
      joined_at timestamptz
    );
  end if;
end$$;

-- get_organization_members: Get all members of an organization with user info
-- Only members of the org can call this
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

-- Grant execute permission
grant execute on function roiheimen.get_organization_members(integer) to roiheimen_user;
