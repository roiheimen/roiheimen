drop schema if exists roiheimen_private cascade;
drop schema if exists roiheimen cascade;

create schema roiheimen;
create schema roiheimen_private;

-- Extensions
create extension if not exists "pgcrypto";

-- Roles

create role roiheimen_postgraphile login password 'xyz';
create role roiheimen_anonymous;
create role roiheimen_person;

-- R:jwt

create type roiheimen.jwt_token as (
  role text,
  person_id integer,
  meeting_id text,
  admin boolean,
  exp bigint,
  user_id integer
);

-- Result type for user registration
create type roiheimen.register_user_result as (
  user_id integer,
  verification_token text
);

-- Tables

-- meeting
create table roiheimen.meeting (
  id               text primary key check (char_length(id) < 32),
  title            text default '' check (char_length(id) < 128),
  theme            jsonb default '{}',
  config           jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.meeting is 'A meeting, i.e. "meet20"';

-- sak (like agendaitem)
create table roiheimen.sak (
  id               serial primary key,
  title            text not null,
  config           jsonb default '{}',
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  finished_at      timestamptz default null
);
comment on table roiheimen.sak is 'A sak is one agende item that can have speeches connected to it.';
create index on roiheimen.sak(meeting_id);
create index on roiheimen.sak(created_at);
create index on roiheimen.sak(finished_at);

-- person
create table roiheimen.person (
  id               serial primary key,
  num              integer,
  name             text not null check (char_length(name) < 128),
  admin            boolean default false,
  meeting_id       text not null references roiheimen.meeting(id) on delete cascade,
  org              text not null default '',
  room             text not null default '',
  created_at       timestamp default now(),
  updated_at       timestamp default now(),
  unique(num, meeting_id)
);
comment on table roiheimen.person is 'A registered person with name+num.';
create index on roiheimen.person(meeting_id);

-- person_account
create table roiheimen_private.person_account (
  person_id        integer primary key references roiheimen.person(id) on delete cascade,
  email            text null check (email ~* '^.+@.+\..+$'),
  password_hash    text not null
);
comment on table roiheimen_private.person_account is 'Private information about a person’s account.';
create index on roiheimen_private.person_account(person_id);

-- person_login
create table roiheimen_private.person_login (
  id               serial primary key,
  person_id        integer references roiheimen.person(id) on delete cascade,
  login_at         timestamp default now(),
  logout_at        timestamp null
);
comment on table roiheimen_private.person_login is 'Private information about a person’s login.';
create index on roiheimen_private.person_login(person_id);
create index on roiheimen_private.person_login(logout_at);
create unique index idx_no_double_login on roiheimen_private.person_login (person_id, (logout_at is null)) where logout_at is null;

-- speech
create type roiheimen.speech_type as enum (
  'innleiing',
  'innlegg',
  'replikk',
  'saksopplysing'
);
create table roiheimen.speech (
  id               serial primary key,
  speaker_id       integer not null references roiheimen.person(id) on delete cascade,
  sak_id           integer not null references roiheimen.sak(id) on delete cascade,
  parent_id        integer null references roiheimen.speech(id) on delete set null,
  type             roiheimen.speech_type not null default 'innlegg',
  started_at       timestamp,
  ended_at         timestamp,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);
comment on table roiheimen.speech is 'A speech done by a person on a sak.';
create index on roiheimen.speech(speaker_id);
create index on roiheimen.speech(sak_id);
create index on roiheimen.speech(parent_id);
create index on roiheimen.speech(created_at);
create index on roiheimen.speech(started_at);
create index on roiheimen.speech(ended_at);

-- test
create table roiheimen.test (
  id               serial primary key,
  requester_id     integer not null references roiheimen.person(id) on delete cascade,
  created_at       timestamptz default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
comment on table roiheimen.test is 'A test (soundcheck, or talk to people) opened by a person.';
create index on roiheimen.test(requester_id);
create index on roiheimen.test(finished_at);

-- vote
create type roiheimen.referendum_type as enum (
  'open',
  'closed'
);
create table roiheimen.referendum (
  id               serial primary key,
  title            text not null,
  type             roiheimen.referendum_type not null default 'open',
  choices          jsonb default '[]',
  sak_id           integer not null references roiheimen.sak(id) on delete cascade,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  started_at       timestamptz default null,
  finished_at      timestamptz default null
);
comment on table roiheimen.referendum is 'A referendum opened on a sak.';
create index on roiheimen.referendum(sak_id);
create index on roiheimen.referendum(started_at);
create index on roiheimen.referendum(created_at);
create index on roiheimen.referendum(finished_at);

create table roiheimen.vote (
  id               serial primary key,
  vote             text not null,
  referendum_id    integer not null references roiheimen.referendum(id) on delete cascade,
  person_id        integer not null references roiheimen.person(id) on delete cascade,
  created_at       timestamptz default now(),
  unique(referendum_id, person_id)
);
comment on table roiheimen.vote is 'A vote by a person.';
create index on roiheimen.vote(referendum_id);
create index on roiheimen.vote(person_id);
create index on roiheimen.vote(created_at);

-- log
create type roiheimen.log_type as enum (
  'log',
  'emoji',
  'online'
);
create table roiheimen.log (
  id               serial primary key,
  type             roiheimen.log_type not null default 'log',
  data             jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.log is 'A log of happenings';

-- user_account: Global user accounts (not meeting-specific)
create table roiheimen.user_account (
  id               serial primary key,
  email            text not null unique check (email ~* '^.+@.+\..+$'),
  name             text not null check (char_length(name) > 0 and char_length(name) < 128),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.user_account is 'Global user accounts with email-based authentication';
create index on roiheimen.user_account(email);
create index on roiheimen.user_account(created_at);

-- user_credentials: Private credentials and verification status
create table roiheimen_private.user_credentials (
  user_id          integer primary key references roiheimen.user_account(id) on delete cascade,
  password_hash    text not null,
  email_verified   boolean default false,
  failed_attempts  integer default 0,
  first_failed_at  timestamptz default null
);
comment on table roiheimen_private.user_credentials is 'Private credentials for user accounts';

-- email_verification: Tokens for email verification
create table roiheimen_private.email_verification (
  id               serial primary key,
  user_id          integer not null references roiheimen.user_account(id) on delete cascade,
  token            text not null unique,
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  used_at          timestamptz default null,
  created_at       timestamptz default now()
);
comment on table roiheimen_private.email_verification is 'Email verification tokens';
create index on roiheimen_private.email_verification(user_id);
create index on roiheimen_private.email_verification(token);
create index on roiheimen_private.email_verification(expires_at);

-- password_reset: Tokens for password reset
create table roiheimen_private.password_reset (
  id               serial primary key,
  user_id          integer not null references roiheimen.user_account(id) on delete cascade,
  token            text not null unique,
  expires_at       timestamptz not null default (now() + interval '1 hour'),
  used_at          timestamptz default null,
  created_at       timestamptz default now()
);
comment on table roiheimen_private.password_reset is 'Password reset tokens';
create index on roiheimen_private.password_reset(user_id);
create index on roiheimen_private.password_reset(token);
create index on roiheimen_private.password_reset(expires_at);

-- user_session: Login session tracking
create table roiheimen_private.user_session (
  id               serial primary key,
  user_id          integer not null references roiheimen.user_account(id) on delete cascade,
  login_at         timestamptz default now(),
  logout_at        timestamptz default null
);
comment on table roiheimen_private.user_session is 'User login session tracking';
create index on roiheimen_private.user_session(user_id);
create index on roiheimen_private.user_session(logout_at);

-- organization: Organizations that can own meetings
create table roiheimen.organization (
  id               serial primary key,
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) >= 2 and char_length(slug) <= 64),
  name             text not null check (char_length(name) > 0 and char_length(name) <= 128),
  config           jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
comment on table roiheimen.organization is 'An organization that can own meetings';
create index on roiheimen.organization(slug);
create index on roiheimen.organization(created_at);

-- organization_role: Role of a user in an organization
create type roiheimen.organization_role as enum ('owner', 'admin', 'member');

-- organization_member: Members of an organization
create table roiheimen.organization_member (
  id               serial primary key,
  organization_id  integer not null references roiheimen.organization(id) on delete cascade,
  user_id          integer not null references roiheimen.user_account(id) on delete cascade,
  role             roiheimen.organization_role not null default 'member',
  created_at       timestamptz default now(),
  unique(organization_id, user_id)
);
comment on table roiheimen.organization_member is 'Members of an organization with their roles';
create index on roiheimen.organization_member(organization_id);
create index on roiheimen.organization_member(user_id);

-- organization_invite: Pending invitations to join an organization
create table roiheimen.organization_invite (
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
create index on roiheimen.organization_invite(organization_id);
create index on roiheimen.organization_invite(email);
create index on roiheimen.organization_invite(token);

-- Add organization_id and created_by columns to meeting table
-- (Added after organization and user_account tables exist)
alter table roiheimen.meeting
  add column organization_id integer references roiheimen.organization(id) on delete set null;
alter table roiheimen.meeting
  add column created_by integer references roiheimen.user_account(id) on delete set null;
create index on roiheimen.meeting(organization_id);
create index on roiheimen.meeting(created_by);

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

-- Views

drop view if exists ordered_speech;
create view ordered_speech as
  select *
  from roiheimen.speech
  where sak_id = (select max(id) from roiheimen.sak)
  order by coalesce(parent_id, id) asc, created_at asc;

-- Functions

create or replace function roiheimen.authenticate(
  num integer,
  meeting_id text,
  password text
) returns roiheimen.jwt_token as $$
declare
  person roiheimen.person;
  account roiheimen_private.person_account;
begin
  select * into person
    from roiheimen.person p
    where p.num = $1 and p.meeting_id = $2;
  select *  into account
    from roiheimen_private.person_account as a
    where person.id = a.person_id;

  if account.password_hash = crypt(password, account.password_hash) then
    update roiheimen_private.person_login
      set logout_at = now()
      where person_id = account.person_id
      and logout_at is null;
    insert into roiheimen_private.person_login (person_id)
      values (account.person_id);
    return (
      'roiheimen_person',
      account.person_id,
      $2,
      person.admin,
      extract(epoch from (now() + interval '6 days')),
      null
    )::roiheimen.jwt_token;
  else
    return null;
  end if;
end;
$$ language plpgsql strict security definer;
comment on function roiheimen.authenticate(integer, text, text) is 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 6 days.';

create function roiheimen.logout(person_id integer) returns roiheimen_private.person_login as $$
  update roiheimen_private.person_login
    set logout_at = now()
    where logout_at is null
    and person_id = coalesce($1::text, current_setting('jwt.claims.person_id', true))::integer
    returning *;
$$ language sql strict security definer;

create function roiheimen.person_latest_speech(person roiheimen.person) returns roiheimen.speech as $$
  select speech.*
  from roiheimen.speech as speech
  where speech.speaker_id = person.id
  order by created_at desc
  limit 1
$$ language sql stable;
comment on function roiheimen.person_latest_speech(roiheimen.person) is 'Get’s the latest speech written by the person.';

create function roiheimen.register_person(
  num integer,
  name text,
  meeting_id text,
  password text,
  org text,
  email text default null
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  insert into roiheimen.person (num, name, org, meeting_id) values
    (num, name, org, meeting_id)
    returning * into person;

  insert into roiheimen_private.person_account (person_id, email, password_hash) values
    (person.id, email, crypt(password, gen_salt('bf')));

  return person;
end;
$$ language plpgsql security definer;
comment on function roiheimen.register_person(integer, text, text, text, text, text) is 'Registers a single user and creates an account.';

create function roiheimen.change_person(
  l_id integer,
  l_name text,
  l_password text,
  l_org text,
  l_email text default null
) returns roiheimen.person as $$
declare
  person roiheimen.person;
begin
  update roiheimen.person
    set name=l_name, org=l_org
    where id = l_id
    returning * into person;

  update roiheimen_private.person_account
    set email=l_email, password_hash=crypt(l_password, gen_salt('bf'))
    where person_id = l_id;

  return person;
end;
$$ language plpgsql security definer;
comment on function roiheimen.change_person(integer, text, text, text, text) is 'Updates a single person and their account.';

-- input type
drop type roiheimen.people_input;
create type roiheimen.people_input as (
  num integer,
  name text,
  password text,
  org text,
  email text
);

create function roiheimen.register_people(
  meeting_id text,
  people roiheimen.people_input[]
) returns roiheimen.person[] as $$
  declare
    pa roiheimen.people_input;
    p roiheimen.person[];
    pp roiheimen.person;
  begin
    foreach pa in array people loop
      select * from roiheimen.person rp
        where rp.meeting_id = register_people.meeting_id
        and rp.num = pa.num
        into pp;
      if pp.id <> 0 then
        p := p || (select roiheimen.change_person(pp.id, pa.name, pa.password, pa.org, pa.email));
      else
        p := p || (select roiheimen.register_person(pa.num, pa.name, meeting_id, pa.password, pa.org, pa.email));
      end if;
    end loop;

    return p;
  end;
$$ language plpgsql volatile strict set search_path from current;

create function roiheimen.latest_sak(meeting_id text) returns roiheimen.sak as $$
  select *
    from roiheimen.sak
    where finished_at is null
    and meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
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
      and meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
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
  where meeting_id = coalesce($1, current_setting('jwt.claims.meeting_id', true))
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

-- get_meeting_token: Returns a meeting-scoped JWT for a participant
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

grant execute on function roiheimen.authenticate(integer, text, text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.register_person(integer, text, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.change_person(integer, text, text, text, text) to roiheimen_person;
grant execute on function roiheimen.register_people(text, roiheimen.people_input[]) to roiheimen_person;
grant execute on function roiheimen.latest_sak(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_speech(text) to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.current_person() to roiheimen_anonymous, roiheimen_person;
grant execute on function roiheimen.vote_count(integer) to roiheimen_person;
grant execute on function roiheimen.stats_people_meeting(text) to roiheimen_person;

-- User account table permissions
grant select on table roiheimen.user_account to roiheimen_user;
grant update on table roiheimen.user_account to roiheimen_user;

-- User account function permissions (anonymous can register/login/reset password)
grant execute on function roiheimen.register_user(text, text, text) to roiheimen_anonymous;
grant execute on function roiheimen.verify_email(text) to roiheimen_anonymous;
grant execute on function roiheimen.authenticate_user(text, text) to roiheimen_anonymous;
grant execute on function roiheimen.request_password_reset(text) to roiheimen_anonymous;
grant execute on function roiheimen.reset_password(text, text) to roiheimen_anonymous;

-- Authenticated user functions
grant execute on function roiheimen.current_user_account() to roiheimen_user;
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
grant execute on function roiheimen.my_role_in_organization(roiheimen.organization) to roiheimen_user;
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
    meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
  );
create policy update_sak on roiheimen.sak for all using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
  );

create policy select_person on roiheimen.person for select using (true);
create policy update_person on roiheimen.person for update to roiheimen_person
  using (id = nullif(current_setting('jwt.claims.person_id', true), '')::integer);
create policy all_admin_person on roiheimen.person for all to roiheimen_person
  using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
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
      and meeting_id = current_setting('jwt.claims.meeting_id', true)
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
      and meeting_id = current_setting('jwt.claims.meeting_id', true)
    )
  );

create policy select_referendum on roiheimen.referendum for select using (true);
create policy update_referendum on roiheimen.referendum for all using (
    coalesce(current_setting('jwt.claims.admin', true), 'false')::boolean
    and exists (
      select 1 from roiheimen.sak
      where id = sak_id
      and meeting_id = nullif(current_setting('jwt.claims.meeting_id', true), '')
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
      and meeting_id = current_setting('jwt.claims.meeting_id', true)
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
  );

--
-- Triggers
--

-- updated_at
create function roiheimen_private.set_updated_at() returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql;

create trigger person_updated_at before update
  on roiheimen.person
  for each row
  execute procedure roiheimen_private.set_updated_at();

create trigger speech_updated_at before update
  on roiheimen.speech
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- update meeting disallow when sak is
create function roiheimen_private.update_disallowed_voters_on_sak() returns trigger as $$
begin
  if old.finished_at is null and (new.config ? 'voteDisallowNum') then
    update roiheimen.meeting m
      set config = m.config || jsonb_build_object('voteDisallowNum', (new.config->>'voteDisallowNum')::jsonb)
      where m.id = new.meeting_id;
  end if;
  return new;
end;
$$ language plpgsql strict security definer;

create trigger sak_config_update_disallowed_voters
    before update on roiheimen.sak
    for each row
    execute procedure roiheimen_private.update_disallowed_voters_on_sak();

-- updated_at trigger for user_account
create trigger user_account_updated_at before update
  on roiheimen.user_account
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- updated_at trigger for organization
create trigger organization_updated_at before update
  on roiheimen.organization
  for each row
  execute procedure roiheimen_private.set_updated_at();

-- Email triggers (via graphile_worker)
-- These functions check if graphile_worker is available before queuing emails

create or replace function roiheimen_private.queue_verification_email()
returns trigger as $$
declare
  user_record roiheimen.user_account;
begin
  -- Only queue if graphile_worker is available
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
             where n.nspname = 'graphile_worker' and p.proname = 'add_job') then
    -- Get user info for the email
    select * into user_record
      from roiheimen.user_account
      where id = NEW.user_id;

    -- Queue email job via graphile_worker
    perform graphile_worker.add_job(
      'send_email',
      json_build_object(
        'type', 'verification',
        'email', user_record.email,
        'token', NEW.token,
        'name', user_record.name
      )
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger queue_verification_email_on_insert
  after insert on roiheimen_private.email_verification
  for each row
  execute function roiheimen_private.queue_verification_email();

create or replace function roiheimen_private.queue_password_reset_email()
returns trigger as $$
declare
  user_record roiheimen.user_account;
begin
  -- Only queue if graphile_worker is available
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
             where n.nspname = 'graphile_worker' and p.proname = 'add_job') then
    -- Get user info for the email
    select * into user_record
      from roiheimen.user_account
      where id = NEW.user_id;

    -- Queue email job via graphile_worker
    perform graphile_worker.add_job(
      'send_email',
      json_build_object(
        'type', 'password_reset',
        'email', user_record.email,
        'token', NEW.token
      )
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger queue_password_reset_email_on_insert
  after insert on roiheimen_private.password_reset
  for each row
  execute function roiheimen_private.queue_password_reset_email();

-- Test data
-- XXX speechRoom actually has to be hidden from anon!
insert into roiheimen.meeting (id, title, theme, config) values (
  'meet20',
  'Test',
  '{
    "font": "Avenir",
    "head-font": "MDG",
    "head-size": "68px",
    "main-color": "#6a9325",
    "video-bg": "#daf3f4"
  }',
  '{
    "hostname": "roiheimen.s0.no",
    "speechDisabled": false,
    "speechInnleggDisabled": false,
    "gfxIframeOnQueue": true,
    "voteDisallowNum": [],
    "video": false,
    "tests": false,
    "externalCss": "https://mdg.nationbuilder.com/themes/7/5d13d1874764e8ad3dc700ac/0/attachments/15615800231611569455/mobile/main.scss"
   }');


select roiheimen.register_people(
  'meet20',
  array[
    (10, 'Kong Harald', 'test', 'Oslo-laget', null),
    (11, 'Timmi Bristol', 'test', 'Oslo-laget', null),
    (12, 'Dalai Lama', 'test', 'Oslo-laget', null),
    (13, 'Marilyn Monroe', 'test', 'Oslo-laget', null),
    (14, 'Queen Elizabeth', 'test', 'Stavanger-laget', null),
    (15, 'Ivar Aasen', 'test', 'Stavanger-laget', null),
    (16, 'Arne Garborg', 'test', 'Stavanger-laget', null),
    (1000, 'Hulda Garborg', 'test', 'Teknisk', null),
    (1001, 'Timmi adm', 'test', 'Teknisk', null),
    (1002, 'Dalai adm', 'test', 'Teknisk', null),
    (1003, 'Marilyn adm', 'test', 'Teknisk', null),
    (1004, 'Queen adm', 'test', 'Teknisk', null),
    (1005, 'Ivar adm', 'test', 'Teknisk', null),
    (1006, 'Arne adm', 'test', 'Teknisk', null)
  ]::roiheimen.people_input[]
);
update roiheimen.person set admin = true where num >= 1000 and meeting_id = 'meet20';


COPY roiheimen.sak (id, title, meeting_id, created_at, updated_at, finished_at) FROM stdin;
1	Opning	meet20	2020-09-29 20:54:07.189976+02	2020-09-29 20:54:07.189976+02	\N
\.


COPY roiheimen.speech (id, speaker_id, sak_id, type, created_at, updated_at) FROM stdin;
4	1	1	innleiing	2020-09-29 20:54:18.20359	2020-09-29 20:54:18.20359
5	3	1	innlegg	2020-09-29 21:28:21.216097	2020-09-29 21:28:21.216097
6	2	1	innlegg	2020-09-30 00:21:31.327424	2020-09-30 00:21:31.327424
7	1	1	innlegg	2020-09-30 00:33:39.560804	2020-09-30 00:33:39.560804
8	6	1	innlegg	2020-09-30 00:38:43.920796	2020-09-30 00:38:43.920796
\.

SELECT pg_catalog.setval('roiheimen.person_id_seq', 7, true);
SELECT pg_catalog.setval('roiheimen.sak_id_seq', 1, true);
SELECT pg_catalog.setval('roiheimen.speech_id_seq', 8, true);
