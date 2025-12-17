-- Migration 015: Organizations
-- Creates organization and organization_member tables with functions and RLS policies

-- Organization table
create table if not exists roiheimen.organization (
  id               serial primary key,
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) >= 2 and char_length(slug) <= 64),
  name             text not null check (char_length(name) > 0 and char_length(name) <= 128),
  config           jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.organization is 'An organization that can own meetings';
create index if not exists organization_slug_idx on roiheimen.organization(slug);
create index if not exists organization_created_at_idx on roiheimen.organization(created_at);

-- Organization member role enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type roiheimen.organization_role as enum ('owner', 'admin', 'member');
  end if;
end$$;

-- Organization member table
create table if not exists roiheimen.organization_member (
  id               serial primary key,
  organization_id  integer not null references roiheimen.organization(id) on delete cascade,
  user_id          integer not null references roiheimen.user_account(id) on delete cascade,
  role             roiheimen.organization_role not null default 'member',
  created_at       timestamptz default now(),
  unique(organization_id, user_id)
);
comment on table roiheimen.organization_member is 'Members of an organization with their roles';
create index if not exists org_member_org_idx on roiheimen.organization_member(organization_id);
create index if not exists org_member_user_idx on roiheimen.organization_member(user_id);

-- Organization invite table (for pending email invites)
create table if not exists roiheimen.organization_invite (
  id               serial primary key,
  organization_id  integer not null references roiheimen.organization(id) on delete cascade,
  email            text not null check (email ~* '^.+@.+\..+$'),
  role             roiheimen.organization_role not null default 'member',
  invited_by       integer not null references roiheimen.user_account(id) on delete cascade,
  token            text not null unique,
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz default null,
  created_at       timestamptz default now(),
  unique(organization_id, email)
);
comment on table roiheimen.organization_invite is 'Pending invitations to join an organization';
create index if not exists org_invite_org_idx on roiheimen.organization_invite(organization_id);
create index if not exists org_invite_email_idx on roiheimen.organization_invite(email);
create index if not exists org_invite_token_idx on roiheimen.organization_invite(token);

-- updated_at trigger for organization
create trigger organization_updated_at before update
  on roiheimen.organization
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- Functions

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

-- my_role_in_organization: Get current user's role in an organization
create or replace function roiheimen.my_role_in_organization(
  org roiheimen.organization
) returns roiheimen.organization_role as $$
  select role
    from roiheimen.organization_member
    where organization_id = org.id
      and user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer;
$$ language sql stable;
comment on function roiheimen.my_role_in_organization(roiheimen.organization) is 'Returns the current user''s role in the given organization';

-- Permissions

grant select on table roiheimen.organization to roiheimen_user;
grant select on table roiheimen.organization_member to roiheimen_user;
grant select on table roiheimen.organization_invite to roiheimen_user;
grant usage on sequence roiheimen.organization_id_seq to roiheimen_user;
grant usage on sequence roiheimen.organization_member_id_seq to roiheimen_user;
grant usage on sequence roiheimen.organization_invite_id_seq to roiheimen_user;

grant execute on function roiheimen.create_organization(text, text) to roiheimen_user;
grant execute on function roiheimen.update_organization(integer, text, jsonb) to roiheimen_user;
grant execute on function roiheimen.invite_to_organization(integer, text, roiheimen.organization_role) to roiheimen_user;
grant execute on function roiheimen.accept_organization_invite(text) to roiheimen_user;
grant execute on function roiheimen.remove_organization_member(integer, integer) to roiheimen_user;
grant execute on function roiheimen.delete_organization(integer) to roiheimen_user;
grant execute on function roiheimen.my_organizations() to roiheimen_user;
grant execute on function roiheimen.get_organization_by_slug(text) to roiheimen_user;
grant execute on function roiheimen.my_role_in_organization(roiheimen.organization) to roiheimen_user;

-- RLS Policies

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

-- Organization members: can view members of orgs you're in
create policy select_organization_member on roiheimen.organization_member
  for select to roiheimen_user
  using (
    exists (
      select 1 from roiheimen.organization_member om
      where om.organization_id = organization_id
        and om.user_id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
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
