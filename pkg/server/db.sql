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

-- Row lewel security policy
alter table roiheimen.meeting enable row level security;
alter table roiheimen.sak enable row level security;
alter table roiheimen.person enable row level security;
alter table roiheimen.speech enable row level security;
alter table roiheimen.test enable row level security;
alter table roiheimen.referendum enable row level security;
alter table roiheimen.vote enable row level security;

create policy select_meeting on roiheimen.meeting for select using (true);

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
