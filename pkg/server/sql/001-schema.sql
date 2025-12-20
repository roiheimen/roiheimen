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
create index on roiheimen.organization_invite(invited_by);

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
  person_id        integer references roiheimen.person(id) on delete set null, -- Bridge to legacy person table
  created_at       timestamptz default now(),
  unique(meeting_id, user_id),
  unique(meeting_id, participant_num)
);
comment on table roiheimen.meeting_participant is 'Participants who have joined a meeting';
create index on roiheimen.meeting_participant(meeting_id);
create index on roiheimen.meeting_participant(user_id);
create index on roiheimen.meeting_participant(participant_num);
create index on roiheimen.meeting_participant(person_id);
create index on roiheimen.meeting_participant(joined_via);

-- Views

drop view if exists ordered_speech;
create view ordered_speech as
  select *
  from roiheimen.speech
  where sak_id = (select max(id) from roiheimen.sak)
  order by coalesce(parent_id, id) asc, created_at asc;

-- Functions
